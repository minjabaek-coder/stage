"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type ChangeEvent as ReactChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  MousePointer2, Type, Image as ImageIcon, Shapes, LayoutTemplate,
  Undo2, Redo2,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  BringToFront, ArrowUp, ArrowDown, SendToBack,
  Group as GroupIcon, Ungroup, Copy, Trash2,
  Eye, EyeOff, Lock, Unlock,
  RotateCw, Blend, Upload, Pencil, Minus, Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { ComposedBlockBody, ComposedPage } from "@/components/public/composed-page";
import { PAGE_PRESETS, type PagePreset } from "@/lib/magazine-presets";
import {
  type Block,
  type PageLayout,
  type ImageBlock,
  type TextBlock,
  type ShapeBlock,
  LAYOUT_BASE_WIDTH,
} from "@/types/magazine-layout";
import { updatePageLayout } from "@/actions/page-actions";
import { uploadBlogImage } from "@/lib/upload-client";
import {
  ArticlePicker,
  type ArticleOpt,
  type Placement,
} from "@/components/admin/article-picker";
import { FocusPicker } from "@/components/admin/focus-picker";
import { InlineTextEditor } from "@/components/admin/inline-text-editor";

const BASE_W = LAYOUT_BASE_WIDTH; // 440
const BASE_H = Math.round((BASE_W * 3) / 2); // 660

const COLORS = ["#ffffff", "rgba(255,255,255,0.85)", "#c4a35a", "#1f6f72", "#1c1b1b"];

function uid() {
  return "b" + Math.random().toString(36).slice(2, 9);
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clampPct = (v: number, size: number) => Math.max(0, Math.min(100 - size, v));

// 앱 내부 클립보드 — 모듈 스코프라 PageEditor가 page key로 리마운트돼도 유지 → 페이지 간 복붙(D3)
let clipboardStore: Block[] | null = null;


export function PageEditor({
  magazineId,
  pageId,
  pageNumber,
  totalPages,
  initialLayout,
  initialArticleId,
  articles,
  placements = {},
}: {
  magazineId: string;
  pageId: string;
  pageNumber: number;
  totalPages?: number; // 툴바 "페이지 N / M" 표기용
  initialLayout: PageLayout;
  initialArticleId: string | null;
  articles: ArticleOpt[];
  placements?: Record<string, Placement>;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null); // 좌측 도구 레일(도형/레이아웃 팝오버 외부클릭 닫기)
  const toolbarRef = useRef<HTMLDivElement>(null); // 상단 툴바(정렬/레이어 details 외부클릭 닫기)
  const [fitScale, setFitScale] = useState(1); // 가용 영역 기준 fit 배율(baseline)
  const [userZoom, setUserZoom] = useState(1); // 사용자 줌(P5a) — fit 위에 곱)
  const spaceRef = useRef(false); // 스페이스 누름(패닝 모드)
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(initialLayout.blocks ?? []);
  const [pageBg, setPageBg] = useState(initialLayout.pageBg ?? "#ffffff");
  // 멀티 선택(P2). 단일(1개)일 때만 selectedId 파생 → 기존 단일 속성/동작 코드 재사용.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const setSelectedId = (id: string | null) => setSelectedIds(id ? [id] : []);
  const [editingId, setEditingId] = useState<string | null>(null); // 인라인 편집 중 텍스트 블록(E2.3)
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null); // 속성 패널 서식 툴바용
  const [articleId, setArticleId] = useState<string | null>(initialArticleId);
  const [uploading, setUploading] = useState(false);
  const [ratioLock, setRatioLock] = useState(false); // 비율 잠금(W/H 동시 변경)
  // 저장 상태(E2.6): idle(초기) → dirty(변경) → saving → saved
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  // 우클릭 컨텍스트 메뉴(P1)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [shapePop, setShapePop] = useState(false); // 도형 팔레트 팝오버(P3)
  const [layoutPop, setLayoutPop] = useState(false); // 레이아웃 프리셋 팝오버(P4b)

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selected = selectedId ? (blocks.find((b) => b.id === selectedId) ?? null) : null;
  const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), 0);
  const selBlocks = blocks.filter((b) => selectedIds.includes(b.id));
  // 선택셋 합집합 바운딩박스(GB)
  function groupBox() {
    if (selBlocks.length === 0) return null;
    const x = Math.min(...selBlocks.map((b) => b.x));
    const y = Math.min(...selBlocks.map((b) => b.y));
    const r = Math.max(...selBlocks.map((b) => b.x + b.w));
    const btm = Math.max(...selBlocks.map((b) => b.y + b.h));
    return { x, y, w: r - x, h: btm - y };
  }

  // ── P1: 실행취소/다시실행 (전체 스냅샷 히스토리) ──
  type Doc = { blocks: Block[]; pageBg: string };
  const past = useRef<Doc[]>([]);
  const future = useRef<Doc[]>([]);
  const [, bumpHist] = useState(0);
  const dragSnap = useRef<Doc | null>(null); // 드래그 시작 시점 스냅샷(드래그 1회=1엔트리)
  const editSnap = useRef<Doc | null>(null); // 속성 편집 시작 스냅샷(디바운스 커밋)
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushPast = (doc: Doc) => {
    past.current.push(doc);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    bumpHist((v) => v + 1);
  };
  // 속성/정렬/z 변경: 디바운스 커밋(연속 입력은 1엔트리로 합침)
  function commitDebounced() {
    if (!editSnap.current) editSnap.current = { blocks: clone(blocks), pageBg };
    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => {
      if (editSnap.current) { pushPast(editSnap.current); editSnap.current = null; }
    }, 500);
  }
  function flushEdit() {
    if (editTimer.current) { clearTimeout(editTimer.current); editTimer.current = null; }
    if (editSnap.current) { pushPast(editSnap.current); editSnap.current = null; }
  }
  // 구조적 변경(추가/삭제/복제/붙여넣기): 변경 직전 스냅샷을 즉시 기록
  function record() { flushEdit(); pushPast({ blocks: clone(blocks), pageBg }); }
  function undo() {
    flushEdit();
    if (!past.current.length) return;
    future.current.push({ blocks: clone(blocks), pageBg });
    const prev = past.current.pop()!;
    setBlocks(prev.blocks); setPageBg(prev.pageBg);
    setSelectedId(null); setEditingId(null); bumpHist((v) => v + 1);
  }
  function redo() {
    if (!future.current.length) return;
    past.current.push({ blocks: clone(blocks), pageBg });
    const nxt = future.current.pop()!;
    setBlocks(nxt.blocks); setPageBg(nxt.pageBg);
    setSelectedId(null); setEditingId(null); bumpHist((v) => v + 1);
  }

  // 커밋용 패치(속성/정렬/z) — 디바운스 히스토리
  function patch(id: string, p: Partial<Block>) {
    commitDebounced();
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b))
    );
  }
  // 라이브 패치(드래그/리사이즈/nudge) — 히스토리 미기록(시작·종료에서 처리)
  function patchLive(id: string, p: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b))
    );
  }

  function addText() {
    record();
    const b: TextBlock = {
      id: uid(), type: "text", x: 10, y: 10, w: 60, h: 14, z: maxZ + 1,
      html: "텍스트를 입력하세요", color: "#1c1b1b", fontSizePx: 16, align: "left",
    };
    setBlocks((p) => [...p, b]);
    setSelectedId(b.id);
  }
  function addImage() {
    record();
    const b: ImageBlock = {
      id: uid(), type: "image", x: 10, y: 10, w: 50, h: 38, z: maxZ + 1,
      src: "", fit: "cover",
    };
    setBlocks((p) => [...p, b]);
    setSelectedId(b.id);
  }
  function applyPreset(preset: PagePreset) {
    if (blocks.length > 0 && !window.confirm("현재 페이지 내용을 이 레이아웃으로 덮어쓸까요?")) return;
    record();
    const layout = preset.build();
    setBlocks(layout.blocks);
    setPageBg(layout.pageBg ?? "#ffffff");
    setSelectedIds([]);
    setLayoutPop(false);
  }
  function addShape(shape: ShapeBlock["shape"], opts?: { radius?: number }) {
    record();
    const b: ShapeBlock =
      shape === "line"
        ? { id: uid(), type: "shape", shape, x: 20, y: 48, w: 60, h: 4, z: maxZ + 1, stroke: "#1c1b1b", strokeWidth: 2 }
        : { id: uid(), type: "shape", shape, x: 30, y: 38, w: 40, h: shape === "ellipse" ? 28 : 18, z: maxZ + 1, fill: "#1f6f72", radius: opts?.radius ?? (shape === "rect" ? 4 : 0) };
    setBlocks((p) => [...p, b]);
    setSelectedId(b.id);
  }
  function removeSelected() {
    if (selectedIds.length === 0) return;
    record();
    setBlocks((p) => p.filter((b) => !selectedIds.includes(b.id)));
    setSelectedIds([]);
  }
  // ── P1/P2: 복제 / 복사 / 붙여넣기 / nudge (멀티 대응) ──
  function duplicateSelected() {
    if (selBlocks.length === 0) return;
    record();
    const base = maxZ;
    const copies = selBlocks.map((b, i) => ({
      ...clone(b), id: uid(), z: base + 1 + i,
      x: clampPct(b.x + 2.3, b.w), y: clampPct(b.y + 2.3, b.h),
    } as Block));
    setBlocks((p) => [...p, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  }
  function copySelected() {
    if (selBlocks.length) clipboardStore = selBlocks.map((b) => clone(b));
  }
  function pasteClipboard() {
    if (!clipboardStore || !clipboardStore.length) return;
    record();
    const baseZ = maxZ;
    const copies = clipboardStore.map((b, i) => ({
      ...clone(b), id: uid(), z: baseZ + 1 + i,
      x: clampPct(b.x + 3, b.w), y: clampPct(b.y + 3, b.h),
    } as Block));
    setBlocks((p) => [...p, ...copies]);
    setSelectedId(copies[copies.length - 1].id);
  }
  function nudge(key: string, big: boolean) {
    if (selectedIds.length === 0) return;
    commitDebounced();
    const sx = (big ? 10 : 1) / BASE_W * 100;
    const sy = (big ? 10 : 1) / BASE_H * 100;
    const dx = key === "ArrowLeft" ? -sx : key === "ArrowRight" ? sx : 0;
    const dy = key === "ArrowUp" ? -sy : key === "ArrowDown" ? sy : 0;
    setBlocks((prev) =>
      prev.map((b) =>
        selectedIds.includes(b.id)
          ? ({ ...b, x: round(clampPct(b.x + dx, b.w)), y: round(clampPct(b.y + dy, b.h)) } as Block)
          : b
      )
    );
  }

  // ── 정렬(캔버스 기준) / 레이어(z-order) / 비율잠금 크기 ──
  function alignH(where: "left" | "center" | "right") {
    if (!selected) return;
    const w = selected.w;
    const x = where === "left" ? 0 : where === "center" ? (100 - w) / 2 : 100 - w;
    patch(selected.id, { x: round(x) });
  }
  function alignV(where: "top" | "middle" | "bottom") {
    if (!selected) return;
    const h = selected.h;
    const y = where === "top" ? 0 : where === "middle" ? (100 - h) / 2 : 100 - h;
    patch(selected.id, { y: round(y) });
  }
  function zOrder(action: "front" | "forward" | "backward" | "back") {
    if (!selected) return;
    const z =
      action === "front" ? maxZ + 1
      : action === "forward" ? selected.z + 1
      : action === "backward" ? Math.max(0, selected.z - 1)
      : 0;
    patch(selected.id, { z });
  }
  // 비율 잠금 시 W/H 입력은 픽셀 종횡비를 유지하며 짝을 함께 변경
  function patchSize(field: "w" | "h", val: number) {
    if (!selected) return;
    if (!ratioLock) { patch(selected.id, { [field]: val } as Partial<Block>); return; }
    const wpx = (selected.w / 100) * BASE_W, hpx = (selected.h / 100) * BASE_H;
    if (field === "w") {
      const nwpx = (val / 100) * BASE_W;
      const nhpx = wpx > 0 ? nwpx * (hpx / wpx) : hpx;
      patch(selected.id, { w: val, h: round((nhpx / BASE_H) * 100) });
    } else {
      const nhpx = (val / 100) * BASE_H;
      const nwpx = hpx > 0 ? nhpx * (wpx / hpx) : wpx;
      patch(selected.id, { h: val, w: round((nwpx / BASE_W) * 100) });
    }
  }

  // ── P2: 그룹 / 다중 정렬·분배 (그룹 바운딩박스 기준) ──
  function groupSelected() {
    if (selectedIds.length < 2) return;
    record();
    const gid = "g" + uid();
    setBlocks((prev) => prev.map((b) => (selectedIds.includes(b.id) ? ({ ...b, groupId: gid } as Block) : b)));
  }
  function ungroupSelected() {
    const gids = new Set(selBlocks.map((b) => b.groupId).filter(Boolean));
    if (gids.size === 0) return;
    record();
    setBlocks((prev) => prev.map((b) => (b.groupId && gids.has(b.groupId) ? ({ ...b, groupId: undefined } as Block) : b)));
  }
  function alignMulti(mode: "left" | "cx" | "right" | "top" | "cy" | "bottom") {
    const gb = groupBox();
    if (!gb || selectedIds.length < 2) return;
    record();
    setBlocks((prev) => prev.map((b) => {
      if (!selectedIds.includes(b.id)) return b;
      let { x, y } = b;
      if (mode === "left") x = gb.x; else if (mode === "right") x = gb.x + gb.w - b.w; else if (mode === "cx") x = gb.x + (gb.w - b.w) / 2;
      if (mode === "top") y = gb.y; else if (mode === "bottom") y = gb.y + gb.h - b.h; else if (mode === "cy") y = gb.y + (gb.h - b.h) / 2;
      return { ...b, x: round(x), y: round(y) } as Block;
    }));
  }
  function distributeMulti(axis: "x" | "y") {
    if (selBlocks.length < 3) return;
    record();
    const get = (b: Block) => (axis === "x" ? b.x : b.y);
    const size = (b: Block) => (axis === "x" ? b.w : b.h);
    const sorted = [...selBlocks].sort((a, b) => get(a) - get(b));
    const start = get(sorted[0]);
    const end = get(sorted[sorted.length - 1]) + size(sorted[sorted.length - 1]);
    const total = sorted.reduce((s, b) => s + size(b), 0);
    const gap = (end - start - total) / (sorted.length - 1);
    const pos = new Map<string, number>();
    let cur = start;
    for (const b of sorted) { pos.set(b.id, cur); cur += size(b) + gap; }
    setBlocks((prev) => prev.map((b) =>
      pos.has(b.id) ? ({ ...b, ...(axis === "x" ? { x: round(pos.get(b.id)!) } : { y: round(pos.get(b.id)!) }) } as Block) : b
    ));
  }

  // ── 드래그 이동 / 8방향 리사이즈 (pointer capture) + 스냅 가이드 ──
  const [snap, setSnap] = useState<{ v: number | null; h: number | null }>({
    v: null,
    h: null,
  });
  // 마키(러버밴드) 선택(P2)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; rect: { x: number; y: number; w: number; h: number } } | null>(null);
  function canvasPct(clientX: number, clientY: number) {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  }
  function onCanvasPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0 || spaceRef.current) return; // 스페이스 패닝 중엔 마키 시작 안 함
    setEditingId(null);
    setSelectedIds([]);
    const p = canvasPct(e.clientX, e.clientY);
    marqueeRef.current = { x0: p.x, y0: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 } };
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function onCanvasPointerMove(e: ReactPointerEvent) {
    const m = marqueeRef.current;
    if (!m) return;
    const p = canvasPct(e.clientX, e.clientY);
    const rect = { x: Math.min(m.x0, p.x), y: Math.min(m.y0, p.y), w: Math.abs(p.x - m.x0), h: Math.abs(p.y - m.y0) };
    m.rect = rect;
    setMarquee(rect);
  }
  function onCanvasPointerUp() {
    const m = marqueeRef.current;
    marqueeRef.current = null;
    setMarquee(null);
    if (!m) return;
    const r = m.rect;
    if (r.w > 1 || r.h > 1) {
      const hits = blocks
        .filter((b) => !b.hidden && !b.locked && !(b.x + b.w < r.x || r.x + r.w < b.x || b.y + b.h < r.y || r.y + r.h < b.y))
        .map((b) => b.id);
      setSelectedIds(hits);
    }
  }
  const drag = useRef<{
    mode: "move" | "resize" | "gresize";
    id: string;
    sx: number; sy: number;
    bx: number; by: number; bw: number; bh: number;
    dx?: -1 | 0 | 1; // 리사이즈 방향(가로)
    dy?: -1 | 0 | 1; // 리사이즈 방향(세로)
    starts?: { id: string; x: number; y: number; w: number; h: number }[]; // 멀티 이동/리사이즈 시작 위치
    gb0?: { x: number; y: number; w: number; h: number }; // 그룹 리사이즈 시작 바운딩박스
    moved?: boolean; // 드래그 임계 초과 여부(클릭 vs 드래그 구분)
    wasSelected?: boolean; // pointerDown 시점 이미 선택돼 있었나(선택된 텍스트 재클릭=편집 판정)
  } | null>(null);

  const SNAP = 1.5; // % 스냅 임계
  const DRAG_THRESHOLD = 4; // px — 이 이하 이동은 클릭으로 간주(블록을 움직이지 않음)
  const SNAP_TARGETS = [0, 50, 100];
  // 이동 시 스냅 — 캔버스 0/50/100 + 비선택 블록의 가장자리·중심(P2d 객체간 가이드)
  function snapMove(nx: number, ny: number, bw: number, bh: number) {
    const xs = [...SNAP_TARGETS];
    const ys = [...SNAP_TARGETS];
    for (const o of blocks) {
      if (selectedIds.includes(o.id)) continue;
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    let gv: number | null = null;
    let gh: number | null = null;
    for (const t of xs) {
      if (Math.abs(nx - t) < SNAP) { nx = t; gv = t; break; }
      if (Math.abs(nx + bw / 2 - t) < SNAP) { nx = t - bw / 2; gv = t; break; }
      if (Math.abs(nx + bw - t) < SNAP) { nx = t - bw; gv = t; break; }
    }
    for (const t of ys) {
      if (Math.abs(ny - t) < SNAP) { ny = t; gh = t; break; }
      if (Math.abs(ny + bh / 2 - t) < SNAP) { ny = t - bh / 2; gh = t; break; }
      if (Math.abs(ny + bh - t) < SNAP) { ny = t - bh; gh = t; break; }
    }
    return { nx, ny, gv, gh };
  }

  function rectWH() {
    const r = canvasRef.current?.getBoundingClientRect();
    return { w: r?.width || BASE_W, h: r?.height || BASE_H };
  }

  // 캡처를 누른 요소(currentTarget)에 걸고, move/up도 같은 요소에서 처리 → 안정적 드래그
  function onBlockPointerDown(e: ReactPointerEvent, b: Block) {
    e.stopPropagation();
    if (b.locked) return; // 잠금 블록은 캔버스에서 선택/이동 불가(레이어 패널에서 해제)
    // 그룹 블록 클릭 → 그룹 전체를 선택 단위로
    const mates = b.groupId ? blocks.filter((x) => x.groupId === b.groupId).map((x) => x.id) : [b.id];
    if (e.button !== 0) { // 우클릭=선택만(컨텍스트 메뉴)
      if (!selectedIds.includes(b.id)) setSelectedIds(mates);
      return;
    }
    setEditingId(null);
    if (e.shiftKey) { // Shift-클릭 = 선택 토글(드래그 안 함)
      setSelectedIds((cur) =>
        cur.includes(b.id) ? cur.filter((id) => !mates.includes(id)) : [...new Set([...cur, ...mates])]
      );
      return;
    }
    // 이미 선택셋에 포함이면 멀티 유지, 아니면 단일(또는 그룹) 선택
    const nextSel = selectedIds.includes(b.id) ? selectedIds : mates;
    if (!selectedIds.includes(b.id)) setSelectedIds(nextSel);
    flushEdit();
    dragSnap.current = { blocks: clone(blocks), pageBg };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const starts = blocks
      .filter((x) => nextSel.includes(x.id))
      .map((x) => ({ id: x.id, x: x.x, y: x.y, w: x.w, h: x.h }));
    drag.current = { mode: "move", id: b.id, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, bw: b.w, bh: b.h, starts, moved: false, wasSelected: selectedIds.includes(b.id) };
  }
  function onHandlePointerDown(
    e: ReactPointerEvent,
    b: Block,
    dx: -1 | 0 | 1,
    dy: -1 | 0 | 1,
  ) {
    e.stopPropagation();
    setSelectedId(b.id);
    flushEdit();
    dragSnap.current = { blocks: clone(blocks), pageBg }; // 리사이즈 전 스냅샷
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    drag.current = { mode: "resize", id: b.id, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, bw: b.w, bh: b.h, dx, dy };
  }
  // 그룹 바운딩박스 8핸들(멀티 리사이즈, P2d)
  function onGroupHandlePointerDown(e: ReactPointerEvent, dx: -1 | 0 | 1, dy: -1 | 0 | 1) {
    e.stopPropagation();
    const gb = groupBox();
    if (!gb) return;
    flushEdit();
    dragSnap.current = { blocks: clone(blocks), pageBg };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const starts = selBlocks.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
    drag.current = { mode: "gresize", id: "", sx: e.clientX, sy: e.clientY, bx: 0, by: 0, bw: 0, bh: 0, dx, dy, starts, gb0: gb };
  }
  function onDragMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { w, h } = rectWH();
    const dxPct = ((e.clientX - d.sx) / w) * 100;
    const dyPct = ((e.clientY - d.sy) / h) * 100;

    if (d.mode === "gresize" && d.gb0 && d.starts) {
      const g = d.gb0;
      let nx = g.x, ny = g.y, nw = g.w, nh = g.h;
      if (d.dx === 1) nw = g.w + dxPct; else if (d.dx === -1) { nx = g.x + dxPct; nw = g.w - dxPct; }
      if (d.dy === 1) nh = g.h + dyPct; else if (d.dy === -1) { ny = g.y + dyPct; nh = g.h - dyPct; }
      if (nw < 4) { if (d.dx === -1) nx = g.x + g.w - 4; nw = 4; }
      if (nh < 3) { if (d.dy === -1) ny = g.y + g.h - 3; nh = 3; }
      if (nx < 0) { nw += nx; nx = 0; } if (ny < 0) { nh += ny; ny = 0; }
      if (nx + nw > 100) nw = 100 - nx; if (ny + nh > 100) nh = 100 - ny;
      const sx = nw / g.w, sy = nh / g.h;
      setBlocks((prev) => prev.map((b) => {
        const s = d.starts!.find((s) => s.id === b.id);
        if (!s) return b;
        return { ...b, x: round(nx + (s.x - g.x) * sx), y: round(ny + (s.y - g.y) * sy), w: round(Math.max(2, s.w * sx)), h: round(Math.max(2, s.h * sy)) } as Block;
      }));
      return;
    }

    if (d.mode === "move") {
      // 임계(4px) 넘기 전엔 이동하지 않음 → 제자리 클릭은 선택만(블록 안 움직임)
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
        d.moved = true;
      }
      const starts = d.starts ?? [{ id: d.id, x: d.bx, y: d.by, w: d.bw, h: d.bh }];
      // 선택셋 전체가 캔버스 안에 남도록 dx/dy 공통 클램프
      let dx = dxPct, dy = dyPct;
      for (const s of starts) {
        dx = Math.min(Math.max(dx, -s.x), 100 - s.w - s.x);
        dy = Math.min(Math.max(dy, -s.y), 100 - s.h - s.y);
      }
      // 스냅·가이드는 단일 선택일 때만(객체간 포함)
      if (starts.length === 1) {
        const s0 = starts[0];
        const s = snapMove(s0.x + dx, s0.y + dy, s0.w, s0.h);
        dx = clampPct(s.nx, s0.w) - s0.x;
        dy = clampPct(s.ny, s0.h) - s0.y;
        setSnap({ v: s.gv, h: s.gh });
      } else {
        setSnap({ v: null, h: null });
      }
      setBlocks((prev) =>
        prev.map((b) => {
          const s = starts.find((s) => s.id === b.id);
          return s ? ({ ...b, x: round(s.x + dx), y: round(s.y + dy) } as Block) : b;
        })
      );
      return;
    }

    // 8방향 리사이즈
    let nx = d.bx, ny = d.by, nw = d.bw, nh = d.bh;
    if (d.dx === 1) nw = d.bw + dxPct;
    else if (d.dx === -1) { nx = d.bx + dxPct; nw = d.bw - dxPct; }
    if (d.dy === 1) nh = d.bh + dyPct;
    else if (d.dy === -1) { ny = d.by + dyPct; nh = d.bh - dyPct; }
    // 최소 크기
    if (nw < 4) { if (d.dx === -1) nx = d.bx + d.bw - 4; nw = 4; }
    if (nh < 3) { if (d.dy === -1) ny = d.by + d.bh - 3; nh = 3; }
    // 경계
    if (nx < 0) { nw += nx; nx = 0; }
    if (ny < 0) { nh += ny; ny = 0; }
    if (nx + nw > 100) nw = 100 - nx;
    if (ny + nh > 100) nh = 100 - ny;
    // 움직이는 모서리 스냅 + 가이드
    let gv: number | null = null, gh: number | null = null;
    if (d.dx !== 0) {
      const edge = d.dx === 1 ? nx + nw : nx;
      for (const t of SNAP_TARGETS) if (Math.abs(edge - t) < SNAP) {
        if (d.dx === 1) nw = t - nx; else { nw = nx + nw - t; nx = t; }
        gv = t; break;
      }
    }
    if (d.dy !== 0) {
      const edge = d.dy === 1 ? ny + nh : ny;
      for (const t of SNAP_TARGETS) if (Math.abs(edge - t) < SNAP) {
        if (d.dy === 1) nh = t - ny; else { nh = ny + nh - t; ny = t; }
        gh = t; break;
      }
    }
    setSnap({ v: gv, h: gh });
    patchLive(d.id, { x: nx, y: ny, w: Math.max(4, nw), h: Math.max(3, nh) });
  }
  function onDragEnd() {
    const d = drag.current;
    drag.current = null;
    setSnap({ v: null, h: null });
    // 클릭(이동 없음) + 텍스트 + 이미 선택돼 있던 블록 → 인라인 편집 진입(선택된 텍스트 재클릭 편집)
    if (d && d.mode === "move" && !d.moved && d.wasSelected) {
      const b = blocks.find((x) => x.id === d.id);
      if (b?.type === "text") setEditingId(d.id);
    }
    // 드래그/리사이즈 1회 = 히스토리 1엔트리(실제 변경 시에만)
    if (dragSnap.current) {
      if (JSON.stringify(dragSnap.current.blocks) !== JSON.stringify(blocks)) {
        pushPast(dragSnap.current);
      }
      dragSnap.current = null;
    }
  }

  // 8방향 핸들 정의(방향 + 커서 + 위치)
  const HANDLES: {
    dx: -1 | 0 | 1; dy: -1 | 0 | 1; cursor: string; pos: CSSProperties;
  }[] = [
    { dx: -1, dy: -1, cursor: "nwse-resize", pos: { left: -6, top: -6 } },
    { dx: 0, dy: -1, cursor: "ns-resize", pos: { left: "calc(50% - 7px)", top: -6 } },
    { dx: 1, dy: -1, cursor: "nesw-resize", pos: { right: -6, top: -6 } },
    { dx: -1, dy: 0, cursor: "ew-resize", pos: { left: -6, top: "calc(50% - 7px)" } },
    { dx: 1, dy: 0, cursor: "ew-resize", pos: { right: -6, top: "calc(50% - 7px)" } },
    { dx: -1, dy: 1, cursor: "nesw-resize", pos: { left: -6, bottom: -6 } },
    { dx: 0, dy: 1, cursor: "ns-resize", pos: { left: "calc(50% - 7px)", bottom: -6 } },
    { dx: 1, dy: 1, cursor: "nwse-resize", pos: { right: -6, bottom: -6 } },
  ];

  // 네이티브 label→input 업로드(프로그램적 click 미사용)
  async function handleFileFor(
    blockId: string,
    e: ReactChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBlogImage(file);
      patch(blockId, { src: url } as Partial<ImageBlock>);
      toast.success("이미지가 추가되었습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    }
    setUploading(false);
  }

  // ── 자동저장(E2.6): 변경 디바운스 1.2s + 수동 저장 + 이탈 경고 ──
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false); // 마지막 저장 이후 미저장 변경 존재
  const mountedRef = useRef(false);
  const dataRef = useRef({ blocks, pageBg, articleId });
  dataRef.current = { blocks, pageBg, articleId };

  async function doSave(auto = false) {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    setSaveState("saving");
    const { blocks: b, pageBg: bg, articleId: aid } = dataRef.current;
    try {
      await updatePageLayout(pageId, magazineId, { blocks: b, pageBg: bg }, aid);
      pendingRef.current = false;
      setSaveState("saved");
      if (!auto) { toast.success("저장되었습니다"); router.refresh(); }
    } catch {
      setSaveState("dirty");
      if (!auto) toast.error("저장 실패");
    }
  }

  // 변경 감지 → dirty + 디바운스 자동저장 (초기 마운트는 건너뜀)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    pendingRef.current = true;
    setSaveState("dirty");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(true), 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, pageBg, articleId]);

  // 미저장 상태에서 탭 닫기/새로고침 경고
  useEffect(() => {
    if (saveState !== "dirty" && saveState !== "saving") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [saveState]);

  // 언마운트(페이지 전환) 시 미저장분 즉시 flush
  useEffect(() => {
    return () => {
      if (!pendingRef.current) return;
      const { blocks: b, pageBg: bg, articleId: aid } = dataRef.current;
      updatePageLayout(pageId, magazineId, { blocks: b, pageBg: bg }, aid).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 도형/레이아웃 팝오버: 바깥(레일 밖) 클릭 시 닫기
  useEffect(() => {
    if (!shapePop && !layoutPop) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setShapePop(false);
        setLayoutPop(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [shapePop, layoutPop]);

  // 상단 툴바 정렬/레이어 드롭다운(details): 바깥 클릭 시 열린 것 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      toolbarRef.current?.querySelectorAll("details[open]").forEach((d) => {
        if (!d.contains(e.target as Node)) (d as HTMLDetailsElement).open = false;
      });
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Esc → 인라인 편집 종료
  useEffect(() => {
    if (!editingId) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setEditingId(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editingId]);

  // ── P1: 캔버스 키보드 단축키 (인라인 편집·입력 포커스 시 가드) ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (editingId || !t) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (meta && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (meta && k === "y") { e.preventDefault(); redo(); return; }
      if (meta && k === "d") { e.preventDefault(); duplicateSelected(); return; }
      if (meta && k === "c") { copySelected(); return; }
      if (meta && k === "v") { e.preventDefault(); pasteClipboard(); return; }
      if (meta && k === "g") { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); return; }
      if (meta && k === "a") { e.preventDefault(); setSelectedIds(blocks.map((b) => b.id)); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (selectedIds.length) { e.preventDefault(); removeSelected(); } return; }
      if (e.key === "Escape") { setSelectedIds([]); setCtxMenu(null); return; }
      if (e.key.startsWith("Arrow") && selectedIds.length) { e.preventDefault(); nudge(e.key, e.shiftKey); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, selectedIds, blocks, pageBg]);

  // 컨텍스트 메뉴 바깥 클릭/스크롤 시 닫기
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close, true); };
  }, [ctxMenu]);

  // 캔버스 fit-scale — 가용 영역(wrapRef)에 맞춰 고정 캔버스를 균일 축소(드래그 좌표는 scaled rect 기준이라 무영향)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) {
        const pad = 32;
        setFitScale(Math.min(1, (w - pad) / BASE_W, (h - pad) / BASE_H));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 스페이스 누르고 드래그 → 패닝(P5)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const t = e.target as HTMLElement;
      if (editingId || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      spaceRef.current = true;
      if (wrapRef.current) wrapRef.current.style.cursor = "grab";
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      spaceRef.current = false;
      if (wrapRef.current) wrapRef.current.style.cursor = "";
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [editingId]);

  // ⌘/Ctrl + 휠 → 줌(P5a). passive:false라 native 리스너로.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setUserZoom((z) => Math.min(5 / fitScale, Math.max(0.25 / fitScale, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitScale]);

  const round = (n: number) => Math.round(n * 10) / 10;
  const scale = Math.max(0.05, fitScale * userZoom); // 캔버스 표시 배율(fit × 사용자 줌)
  const zoomBy = (f: number) => setUserZoom((z) => Math.min(5 / fitScale, Math.max(0.25 / fitScale, z * f)));
  const zoomFit = () => setUserZoom(1);

  return (
    <div className="flex h-full gap-3">
      {/* 좌: 도구 레일 (캔바식) — 요소 추가 */}
      <nav ref={railRef} className="flex w-16 flex-none flex-col items-center gap-1 rounded-lg bg-ink-deep py-2.5">
        <RailTool icon={<MousePointer2 size={18} />} label="선택" active={selectedIds.length === 0} onClick={() => { setSelectedIds([]); setEditingId(null); }} />
        <RailTool icon={<Type size={18} />} label="텍스트" onClick={addText} />
        <RailTool icon={<ImageIcon size={18} />} label="이미지" onClick={addImage} />
        <div className="relative">
          <RailTool icon={<Shapes size={18} />} label="도형" active={shapePop} onClick={() => { setShapePop((v) => !v); setLayoutPop(false); }} />
          {shapePop && (
            <div className="absolute left-full top-0 z-50 ml-2 w-44 rounded-lg border bg-popover p-2 shadow-md">
              <div className="ed-grouplabel mb-1.5">도형</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" title="둥근 사각형" onClick={() => { addShape("rect"); setShapePop(false); }} className="flex h-10 items-center justify-center rounded border hover:bg-accent">
                  <span className="h-4 w-5 rounded-sm bg-foreground/70" />
                </button>
                <button type="button" title="각진 사각형" onClick={() => { addShape("rect", { radius: 0 }); setShapePop(false); }} className="flex h-10 items-center justify-center rounded border hover:bg-accent">
                  <span className="h-4 w-5 bg-foreground/70" />
                </button>
                <button type="button" title="원" onClick={() => { addShape("ellipse"); setShapePop(false); }} className="flex h-10 items-center justify-center rounded border hover:bg-accent">
                  <span className="h-5 w-5 rounded-full bg-foreground/70" />
                </button>
                <button type="button" title="삼각형" onClick={() => { addShape("triangle"); setShapePop(false); }} className="flex h-10 items-center justify-center rounded border hover:bg-accent">
                  <svg width="20" height="18" viewBox="0 0 20 18"><polygon points="10,1 19,17 1,17" className="fill-foreground/70" /></svg>
                </button>
                <button type="button" title="마름모" onClick={() => { addShape("diamond"); setShapePop(false); }} className="flex h-10 items-center justify-center rounded border hover:bg-accent">
                  <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,1 17,9 9,17 1,9" className="fill-foreground/70" /></svg>
                </button>
                <button type="button" title="선" onClick={() => { addShape("line"); setShapePop(false); }} className="flex h-10 items-center justify-center rounded border hover:bg-accent">
                  <span className="h-0.5 w-5 bg-foreground/70" />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <RailTool icon={<LayoutTemplate size={18} />} label="레이아웃" active={layoutPop} onClick={() => { setLayoutPop((v) => !v); setShapePop(false); }} />
          {layoutPop && (
            <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-lg border bg-popover p-2 shadow-md">
              <div className="ed-grouplabel mb-1.5">레이아웃 프리셋 · 현재 페이지에 적용</div>
              <div className="grid grid-cols-3 gap-2">
                {PAGE_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="group/preset text-left">
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded border bg-neutral-50 group-hover/preset:border-primary">
                      <ComposedPage layout={preset.build()} fit="cover" />
                    </div>
                    <div className="mt-0.5 truncate text-[9px] text-muted-foreground">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
      {/* 가운데 컬럼: 툴바 + 캔버스 (목업 .col.center) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
      {/* 캔버스 툴바: 실행취소/다시실행 · 정렬/레이어 · 페이지/줌 · 저장 */}
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-1.5 border-b bg-card px-3 py-2">
        <button type="button" onClick={undo} disabled={past.current.length === 0} title="실행취소 (⌘Z)" className="tbtn ghost"><span className="inline-flex items-center gap-1"><Undo2 size={14} /> 실행취소</span></button>
        <button type="button" onClick={redo} disabled={future.current.length === 0} title="다시실행 (⌘⇧Z)" className="tbtn ghost"><span className="inline-flex items-center gap-1"><Redo2 size={14} /> 다시실행</span></button>
        <span className="tbsep" />
        {/* 정렬 ▾ */}
        <details name="tb-menu" className="relative">
          <summary className={`tbtn ghost list-none ${!selected ? "pointer-events-none opacity-40" : ""}`}>정렬 ▾</summary>
          <div className="absolute left-0 z-30 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
            <div className="grid grid-cols-3 gap-1">
              <button type="button" onClick={() => alignH("left")} title="왼쪽" className="flex items-center justify-center rounded py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><AlignStartVertical size={16} /></button>
              <button type="button" onClick={() => alignH("center")} title="가로 가운데" className="flex items-center justify-center rounded py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><AlignCenterVertical size={16} /></button>
              <button type="button" onClick={() => alignH("right")} title="오른쪽" className="flex items-center justify-center rounded py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><AlignEndVertical size={16} /></button>
              <button type="button" onClick={() => alignV("top")} title="위" className="flex items-center justify-center rounded py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><AlignStartHorizontal size={16} /></button>
              <button type="button" onClick={() => alignV("middle")} title="세로 가운데" className="flex items-center justify-center rounded py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><AlignCenterHorizontal size={16} /></button>
              <button type="button" onClick={() => alignV("bottom")} title="아래" className="flex items-center justify-center rounded py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><AlignEndHorizontal size={16} /></button>
            </div>
          </div>
        </details>
        {/* 레이어 ▾ */}
        <details name="tb-menu" className="relative">
          <summary className={`tbtn ghost list-none ${!selected ? "pointer-events-none opacity-40" : ""}`}>레이어 ▾</summary>
          <div className="absolute left-0 z-30 mt-1 w-32 rounded-md border bg-popover p-1 shadow-md">
            <MenuBtn onClick={() => zOrder("front")} block><span className="inline-flex items-center gap-1"><BringToFront size={14} /> 맨 앞으로</span></MenuBtn>
            <MenuBtn onClick={() => zOrder("forward")} block><span className="inline-flex items-center gap-1"><ArrowUp size={14} /> 앞으로</span></MenuBtn>
            <MenuBtn onClick={() => zOrder("backward")} block><span className="inline-flex items-center gap-1"><ArrowDown size={14} /> 뒤로</span></MenuBtn>
            <MenuBtn onClick={() => zOrder("back")} block><span className="inline-flex items-center gap-1"><SendToBack size={14} /> 맨 뒤로</span></MenuBtn>
          </div>
        </details>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-muted-foreground">
            페이지 {pageNumber}{totalPages ? ` / ${totalPages}` : ""}
          </span>
          {/* 줌 컨트롤(P5a) */}
          <span className="inline-flex items-center overflow-hidden rounded-md border">
            <button type="button" onClick={() => zoomBy(1 / 1.2)} title="축소" className="flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:bg-accent"><Minus size={14} /></button>
            <button type="button" onClick={zoomFit} title="화면 맞춤" className="w-12 border-x py-1 text-center font-mono text-[11px] hover:bg-accent">{Math.round(scale * 100)}%</button>
            <button type="button" onClick={() => zoomBy(1.2)} title="확대" className="flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:bg-accent"><Plus size={14} /></button>
          </span>
          <span className="tbsep" />
          <ArticlePicker
            articles={articles}
            placements={placements}
            value={articleId}
            onChange={setArticleId}
            allowNone
            placeholder="싣는 기사 연동…"
            className="w-[170px]"
          />
          {/* 저장 상태 표시(E2.6) */}
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            {saveState === "saving" ? (
              <span className="text-muted-foreground">저장 중…</span>
            ) : saveState === "dirty" ? (
              <span className="flex items-center gap-1 text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />변경됨</span>
            ) : saveState === "saved" ? (
              <span className="flex items-center gap-1 text-green-600"><span className="h-1.5 w-1.5 rounded-full bg-green-600" />저장됨</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => doSave(false)}
            disabled={saveState === "saving"}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </div>

      {/* 캔버스 래핑: fit×줌 배율로 표시. 줌인 시 overflow-auto로 패닝 스크롤. */}
      <div
        ref={wrapRef}
        className="flex min-h-0 flex-1 overflow-auto bg-[#e9e7e4] p-6"
        onPointerDown={(e) => {
          if (!spaceRef.current || !wrapRef.current) return;
          e.preventDefault();
          panRef.current = { x: e.clientX, y: e.clientY, sl: wrapRef.current.scrollLeft, st: wrapRef.current.scrollTop };
          try { wrapRef.current.setPointerCapture(e.pointerId); } catch {}
          wrapRef.current.style.cursor = "grabbing";
        }}
        onPointerMove={(e) => {
          if (!panRef.current || !wrapRef.current) return;
          wrapRef.current.scrollLeft = panRef.current.sl - (e.clientX - panRef.current.x);
          wrapRef.current.scrollTop = panRef.current.st - (e.clientY - panRef.current.y);
        }}
        onPointerUp={() => { panRef.current = null; if (wrapRef.current) wrapRef.current.style.cursor = spaceRef.current ? "grab" : ""; }}
      >
        {/* 실제 크기 sizer(m-auto 중앙·스크롤 안전) + 좌상단 기준 scale */}
        <div className="m-auto flex-none" style={{ width: BASE_W * scale, height: BASE_H * scale }}>
        <div
          ref={canvasRef}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          className="overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.18)]"
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: "0 0", background: pageBg, touchAction: "none" }}
        >
          {[...blocks].sort((a, b) => a.z - b.z).map((b) => {
            if (b.hidden) return null; // 편집기에서 숨김(뷰어는 항상 렌더)
            const isSel = selectedIds.includes(b.id);
            const isEditing = b.id === editingId && b.type === "text";
            const isEmptyImg = b.type === "image" && !b.src;
            return (
              <div
                key={b.id}
                onPointerDown={(e) => { if (!isEditing) onBlockPointerDown(e, b); }}
                onPointerMove={isEditing ? undefined : onDragMove}
                onPointerUp={isEditing ? undefined : onDragEnd}
                onContextMenu={(e) => {
                  if (isEditing) return;
                  e.preventDefault();
                  if (!selectedIds.includes(b.id)) {
                    setSelectedIds(b.groupId ? blocks.filter((x) => x.groupId === b.groupId).map((x) => x.id) : [b.id]);
                  }
                  setCtxMenu({ x: e.clientX, y: e.clientY });
                }}
                onDoubleClick={(e) => {
                  if (b.type !== "text") return;
                  e.stopPropagation();
                  setSelectedId(b.id);
                  setEditingId(b.id);
                }}
                style={{
                  position: "absolute",
                  left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`,
                  transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                  opacity: b.opacity ?? 1,
                  zIndex: isEditing ? 998 : b.z,
                  outline: isEditing ? "2px solid #2563eb" : isSel ? "1.5px solid #2563eb" : "1px dashed rgba(0,0,0,.25)",
                  cursor: isEditing ? "text" : "move",
                }}
              >
                {isEditing && b.type === "text" ? (
                  <InlineTextEditor
                    block={b}
                    onChange={(html) => patch(b.id, { html } as Partial<TextBlock>)}
                    onReady={setActiveEditor}
                  />
                ) : isEmptyImg ? (
                  <div className="pointer-events-none flex h-full w-full items-center justify-center bg-gray-100 text-center text-[10px] leading-tight text-gray-400">
                    이미지 없음
                    <br />
                    우측 패널에서 업로드
                  </div>
                ) : (
                  <ComposedBlockBody block={b} />
                )}
                {b.id === selectedId && !isEditing &&
                  HANDLES.map((hd) => (
                    <div
                      key={`${hd.dx},${hd.dy}`}
                      onPointerDown={(e) => onHandlePointerDown(e, b, hd.dx, hd.dy)}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                      style={{
                        position: "absolute", width: 12, height: 12,
                        background: "#fff", border: "2px solid #2563eb", borderRadius: 2,
                        cursor: hd.cursor, zIndex: 999, ...hd.pos,
                      }}
                    />
                  ))}
              </div>
            );
          })}

          {/* 스냅 가이드 라인 */}
          {snap.v != null && (
            <div style={{ position: "absolute", left: `${snap.v}%`, top: 0, bottom: 0, width: 1, background: "#ec4899", zIndex: 1000, pointerEvents: "none" }} />
          )}
          {snap.h != null && (
            <div style={{ position: "absolute", top: `${snap.h}%`, left: 0, right: 0, height: 1, background: "#ec4899", zIndex: 1000, pointerEvents: "none" }} />
          )}
          {/* 그룹 바운딩박스 + 8핸들(멀티 선택, P2/P2d) */}
          {selectedIds.length > 1 && (() => {
            const gb = groupBox();
            if (!gb) return null;
            return (
              <div style={{ position: "absolute", left: `${gb.x}%`, top: `${gb.y}%`, width: `${gb.w}%`, height: `${gb.h}%`, border: "1px dashed #2563eb", zIndex: 997, pointerEvents: "none" }}>
                {HANDLES.map((hd) => (
                  <div
                    key={`g${hd.dx},${hd.dy}`}
                    onPointerDown={(e) => onGroupHandlePointerDown(e, hd.dx, hd.dy)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    style={{ position: "absolute", width: 12, height: 12, background: "#fff", border: "2px solid #2563eb", borderRadius: 2, cursor: hd.cursor, zIndex: 999, pointerEvents: "auto", ...hd.pos }}
                  />
                ))}
              </div>
            );
          })()}
          {/* 마키(러버밴드, P2) */}
          {marquee && (
            <div style={{ position: "absolute", left: `${marquee.x}%`, top: `${marquee.y}%`, width: `${marquee.w}%`, height: `${marquee.h}%`, border: "1px solid #2563eb", background: "rgba(37,99,235,0.10)", zIndex: 1001, pointerEvents: "none" }} />
          )}
          {/* 플로팅 텍스트 서식 툴바(P5b) — 편집 중 블록 위, 캔버스 스케일 역보정 */}
          {editingId && activeEditor && (() => {
            const eb = blocks.find((x) => x.id === editingId);
            if (!eb) return null;
            return (
              <div
                style={{ position: "absolute", left: `${eb.x}%`, top: `${eb.y}%`, transform: `translateY(-100%) scale(${1 / scale})`, transformOrigin: "left bottom", zIndex: 1002 }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="mb-1 rounded-md border bg-popover p-1 shadow-md">
                  <FmtToolbar editor={activeEditor} />
                </div>
              </div>
            );
          })()}
        </div>
        </div>
        </div>
      </div>

        {/* 속성 패널 (목업 .col.right · .props) */}
        <aside className="flex w-64 shrink-0 flex-col self-stretch overflow-hidden rounded-lg border bg-card text-sm">
          <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
          {selectedIds.length > 1 ? (
            <div>
              <h4 className="mb-2.5 flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">속성</span>
                <span className="ed-typetag">{selectedIds.length}개 선택</span>
              </h4>
              <Group title="정렬 (선택 영역 기준)" first>
                <div className="ed-iconrow flex gap-1.5">
                  <button type="button" onClick={() => alignMulti("left")} title="왼쪽"><AlignStartVertical size={14} /></button>
                  <button type="button" onClick={() => alignMulti("cx")} title="가로 가운데"><AlignCenterVertical size={14} /></button>
                  <button type="button" onClick={() => alignMulti("right")} title="오른쪽"><AlignEndVertical size={14} /></button>
                  <button type="button" onClick={() => alignMulti("top")} title="위"><AlignStartHorizontal size={14} /></button>
                  <button type="button" onClick={() => alignMulti("cy")} title="세로 가운데"><AlignCenterHorizontal size={14} /></button>
                  <button type="button" onClick={() => alignMulti("bottom")} title="아래"><AlignEndHorizontal size={14} /></button>
                </div>
              </Group>
              <Group title="분배 (3개 이상)">
                <div className="ed-iconrow flex gap-1.5">
                  <button type="button" onClick={() => distributeMulti("x")}><span className="inline-flex items-center gap-1"><AlignHorizontalDistributeCenter size={14} /> 가로</span></button>
                  <button type="button" onClick={() => distributeMulti("y")}><span className="inline-flex items-center gap-1"><AlignVerticalDistributeCenter size={14} /> 세로</span></button>
                </div>
              </Group>
              <Group title="그룹 · 동작">
                <div className="ed-iconrow flex flex-wrap gap-1.5">
                  <button type="button" onClick={groupSelected}><span className="inline-flex items-center gap-1"><GroupIcon size={14} /> 그룹</span></button>
                  <button type="button" onClick={ungroupSelected}><span className="inline-flex items-center gap-1"><Ungroup size={14} /> 그룹 해제</span></button>
                  <button type="button" onClick={duplicateSelected}><span className="inline-flex items-center gap-1"><Copy size={14} /> 복제</span></button>
                  <button type="button" onClick={removeSelected} className="!text-red-600"><span className="inline-flex items-center gap-1"><Trash2 size={14} /> 삭제</span></button>
                </div>
              </Group>
            </div>
          ) : !selected ? (
            <div>
              <h4 className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                속성
              </h4>
              <p className="text-xs text-muted-foreground">
                블록 선택 · Shift-클릭/드래그로 다중 선택.
              </p>
              <div className="mt-3 border-t pt-3">
                <div className="ed-grouplabel">페이지 배경색</div>
                <div className="ed-field">
                  <span className="k">#</span>
                  <input value={pageBg.replace(/^#/, "")} onChange={(e) => { commitDebounced(); setPageBg("#" + e.target.value.replace(/^#/, "")); }} />
                </div>
                <div className="mt-2 flex gap-1.5">
                  {["#ffffff", "#faf7f2", "#111111", "#000000"].map((c) => (
                    <button key={c} type="button" onClick={() => { commitDebounced(); setPageBg(c); }} className="h-6 w-6 rounded border" style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* 헤더: 속성 [typetag] */}
              <h4 className="mb-2.5 flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">속성</span>
                <span className="ed-typetag">{selected.type === "image" ? "이미지 블록" : selected.type === "shape" ? `도형 · ${({ rect: "사각형", ellipse: "원", line: "선", triangle: "삼각형", diamond: "마름모" } as const)[(selected as ShapeBlock).shape]}` : "텍스트 블록"}</span>
                <button type="button" onClick={duplicateSelected} title="복제 (⌘D)" className="ml-auto rounded border px-2 py-0.5 text-xs hover:bg-accent">복제</button>
                <button type="button" onClick={removeSelected} title="삭제 (Del)" className="rounded border px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">삭제</button>
              </h4>

              {/* 위치 · 크기 */}
              <Group title={<>위치 · 크기 <span className="text-muted-foreground/60">(% · 상대단위)</span></>} first>
                <div className="grid grid-cols-2 gap-1.5">
                  <Field k="X" unit="%" value={round(selected.x)} onChange={(v) => patch(selected.id, { x: v })} />
                  <Field k="Y" unit="%" value={round(selected.y)} onChange={(v) => patch(selected.id, { y: v })} />
                  <Field k="W" unit="%" value={round(selected.w)} onChange={(v) => patchSize("w", v)} />
                  <Field k="H" unit="%" value={round(selected.h)} onChange={(v) => patchSize("h", v)} />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRatioLock((v) => !v)}
                    className={`ed-lockbtn ${ratioLock ? "on" : ""}`}
                    title="비율 잠금"
                  >
                    <span className="inline-flex items-center gap-1">{ratioLock ? <Lock size={12} /> : <Unlock size={12} />} 비율</span>
                  </button>
                  <Field className="flex-1" k={<RotateCw size={11} />} unit="°" value={selected.rotation ?? 0} onChange={(v) => patch(selected.id, { rotation: v })} />
                  <Field className="flex-1" k={<Blend size={11} />} unit="%" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(v) => patch(selected.id, { opacity: v / 100 })} />
                </div>
              </Group>

              {/* 정렬(캔버스 기준) */}
              <Group title="정렬">
                <div className="ed-iconrow flex gap-1.5">
                  <button type="button" onClick={() => alignH("left")} title="왼쪽"><AlignStartVertical size={14} /></button>
                  <button type="button" onClick={() => alignH("center")} title="가로 가운데"><AlignCenterVertical size={14} /></button>
                  <button type="button" onClick={() => alignH("right")} title="오른쪽"><AlignEndVertical size={14} /></button>
                  <button type="button" onClick={() => alignV("top")} title="위"><AlignStartHorizontal size={14} /></button>
                  <button type="button" onClick={() => alignV("middle")} title="세로 가운데"><AlignCenterHorizontal size={14} /></button>
                  <button type="button" onClick={() => alignV("bottom")} title="아래"><AlignEndHorizontal size={14} /></button>
                </div>
              </Group>

              {/* 레이어 (z-order) */}
              <Group title="레이어 (z-order)">
                <div className="ed-iconrow flex gap-1.5">
                  <button type="button" onClick={() => zOrder("front")} title="맨 앞으로"><span className="inline-flex items-center gap-1"><BringToFront size={14} /> 맨앞</span></button>
                  <button type="button" onClick={() => zOrder("forward")} title="앞으로"><span className="inline-flex items-center gap-1"><ArrowUp size={14} /> 앞으로</span></button>
                  <button type="button" onClick={() => zOrder("backward")} title="뒤로"><span className="inline-flex items-center gap-1"><ArrowDown size={14} /> 뒤로</span></button>
                  <button type="button" onClick={() => zOrder("back")} title="맨 뒤로"><span className="inline-flex items-center gap-1"><SendToBack size={14} /> 맨뒤</span></button>
                </div>
              </Group>

              {selected.type === "image" ? (
                <Group title="이미지">
                  <div className="mb-2">
                    <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-white py-2 text-xs hover:bg-accent">
                      <Upload size={14} /> {selected.src ? "이미지 교체" : "이미지 업로드"}
                      <input type="file" accept="image/*" onChange={(e) => handleFileFor(selected.id, e)} className="hidden" />
                    </label>
                    {uploading && <p className="mt-1 text-center text-xs text-muted-foreground">업로드 중…</p>}
                  </div>
                  {/* 채움 / 맞춤 */}
                  <div className="ed-iconrow mb-2 flex gap-1.5">
                    {(["cover", "contain"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => patch(selected.id, { fit: f } as Partial<ImageBlock>)}
                        className={(selected.fit ?? "cover") === f ? "on" : ""}
                      >
                        {f === "cover" ? "채움(cover)" : "맞춤(contain)"}
                      </button>
                    ))}
                  </div>
                  <Slider label="어둡게" min={0} max={60} value={selected.overlayDarken ?? 0} display={`${selected.overlayDarken ?? 0}%`} onChange={(v) => patch(selected.id, { overlayDarken: v } as Partial<ImageBlock>)} />
                  <Slider label="모서리" min={0} max={40} value={selected.radius ?? 0} display={`${selected.radius ?? 0}`} onChange={(v) => patch(selected.id, { radius: v } as Partial<ImageBlock>)} />
                  {selected.src && (selected.fit ?? "cover") === "cover" && (
                    <div className="mt-3">
                      <FocusPicker
                        src={selected.src}
                        focusX={selected.focusX ?? 50}
                        focusY={selected.focusY ?? 50}
                        zoom={selected.zoom ?? 1}
                        onChange={(x, y) => patch(selected.id, { focusX: x, focusY: y } as Partial<ImageBlock>)}
                        onZoomChange={(z) => patch(selected.id, { zoom: z } as Partial<ImageBlock>)}
                      />
                    </div>
                  )}
                </Group>
              ) : selected.type === "shape" ? (
                <Group title="도형">
                  {(selected as ShapeBlock).shape !== "line" && (
                    <>
                      <div className="ed-grouplabel">채움색</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {["#1f6f72", "#c4a35a", "#1c1b1b", "#b91c1c", "#2563eb", "#ffffff"].map((c) => (
                          <button key={c} type="button" onClick={() => patch(selected.id, { fill: c } as Partial<ShapeBlock>)} className={`h-6 w-6 rounded-full border ${(selected as ShapeBlock).fill === c ? "ring-2 ring-[#2563eb] ring-offset-1" : ""}`} style={{ background: c }} />
                        ))}
                        <input type="color" title="커스텀 색" value={(selected as ShapeBlock).fill ?? "#1f6f72"} onChange={(e) => patch(selected.id, { fill: e.target.value } as Partial<ShapeBlock>)} className="h-6 w-6 cursor-pointer rounded-full border p-0" />
                      </div>
                    </>
                  )}
                  {(selected as ShapeBlock).shape === "rect" && (
                    <Slider label="모서리" min={0} max={40} value={(selected as ShapeBlock).radius ?? 0} display={`${(selected as ShapeBlock).radius ?? 0}`} onChange={(v) => patch(selected.id, { radius: v } as Partial<ShapeBlock>)} />
                  )}
                  <div className="ed-grouplabel mt-3">{(selected as ShapeBlock).shape === "line" ? "선" : "테두리"}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {["#1c1b1b", "#c4a35a", "#1f6f72", "#b91c1c", "#ffffff"].map((c) => (
                      <button key={c} type="button" onClick={() => patch(selected.id, { stroke: c } as Partial<ShapeBlock>)} className={`h-6 w-6 rounded-full border ${(selected as ShapeBlock).stroke === c ? "ring-2 ring-[#2563eb] ring-offset-1" : ""}`} style={{ background: c }} />
                    ))}
                    <input type="color" title="커스텀 색" value={(selected as ShapeBlock).stroke ?? "#1c1b1b"} onChange={(e) => patch(selected.id, { stroke: e.target.value } as Partial<ShapeBlock>)} className="h-6 w-6 cursor-pointer rounded-full border p-0" />
                  </div>
                  <div className="mt-2">
                    <LabeledField label="두께" unit="px" value={(selected as ShapeBlock).strokeWidth ?? 0} onChange={(v) => patch(selected.id, { strokeWidth: v } as Partial<ShapeBlock>)} />
                  </div>
                </Group>
              ) : (
                <Group title="텍스트">
                  <div className="mb-2">
                    <div className="ed-grouplabel">
                      서식{editingId === selected.id ? "" : " · 블록 더블클릭으로 편집"}
                    </div>
                    <FmtToolbar editor={editingId === selected.id ? activeEditor : null} />
                    {editingId === selected.id ? (
                      <button type="button" onClick={() => setEditingId(null)} className="mt-1.5 text-xs text-muted-foreground hover:underline">편집 종료 (Esc)</button>
                    ) : (
                      <button type="button" onClick={() => setEditingId(selected.id)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Pencil size={12} /> 캔버스에서 편집</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <LabeledField label="글자 크기" unit="px" value={selected.fontSizePx ?? 16} onChange={(v) => patch(selected.id, { fontSizePx: v } as Partial<TextBlock>)} />
                    <div>
                      <div className="ed-grouplabel">정렬</div>
                      <select value={selected.align ?? "left"} onChange={(e) => patch(selected.id, { align: e.target.value as "left" | "center" | "right" } as Partial<TextBlock>)} className="w-full rounded-md border px-2 py-[7px] text-xs">
                        <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
                      </select>
                    </div>
                    <LabeledField label="굵기" value={selected.weight ?? 400} step={100} onChange={(v) => patch(selected.id, { weight: v } as Partial<TextBlock>)} />
                    <LabeledField label="줄간격" value={selected.lineHeight ?? 1.6} step={0.05} onChange={(v) => patch(selected.id, { lineHeight: v } as Partial<TextBlock>)} />
                  </div>
                  <div className="mt-2">
                    <div className="ed-grouplabel">글자색</div>
                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => patch(selected.id, { color: c } as Partial<TextBlock>)} className={`h-6 w-6 rounded-full border ${selected.color === c ? "ring-2 ring-[#2563eb] ring-offset-1" : ""}`} style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
                    <div>
                      <div className="ed-grouplabel">배경색(빈칸=없음)</div>
                      <input type="text" value={selected.bgColor ?? ""} onChange={(e) => patch(selected.id, { bgColor: e.target.value || undefined } as Partial<TextBlock>)} className="w-full rounded-md border px-2 py-[7px] text-xs" />
                    </div>
                    <LabeledField className="w-20" label="여백" unit="px" value={selected.padding ?? 0} onChange={(v) => patch(selected.id, { padding: v } as Partial<TextBlock>)} />
                  </div>
                </Group>
              )}
            </div>
          )}
          </div>

          {/* 레이어 패널 (D6) — z 역순, 클릭 선택 */}
          <div className="max-h-[38%] flex-none overflow-y-auto border-t bg-muted/30 p-2.5">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">레이어</p>
            {blocks.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground">블록 없음</p>
            ) : (
              [...blocks].sort((a, b) => b.z - a.z).map((b) => {
                const isSel = selectedIds.includes(b.id);
                const icon = b.type === "image" ? "🖼" : b.type === "shape" ? ({ ellipse: "○", line: "—", triangle: "△", diamond: "◇", rect: "▭" } as const)[(b as ShapeBlock).shape] : "T";
                const name = b.type === "image"
                  ? (b.src ? "이미지" : "이미지(빈)")
                  : b.type === "shape"
                    ? ({ rect: "사각형", ellipse: "원", line: "선", triangle: "삼각형", diamond: "마름모" } as const)[(b as ShapeBlock).shape]
                    : ((b as TextBlock).html || "텍스트").replace(/<[^>]+>/g, " ").trim().slice(0, 16) || "텍스트";
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${isSel ? "bg-primary/10 text-primary" : "hover:bg-accent"} ${b.hidden ? "opacity-50" : ""}`}
                  >
                    <button type="button" onClick={() => { setSelectedId(b.id); setEditingId(null); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="w-4 text-center text-muted-foreground">{icon}</span>
                      <span className="flex-1 truncate">{name}</span>
                    </button>
                    <button type="button" title={b.hidden ? "표시" : "숨김"} onClick={() => patch(b.id, { hidden: !b.hidden } as Partial<Block>)} className="px-0.5 text-muted-foreground hover:text-foreground">{b.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    <button type="button" title={b.locked ? "잠금 해제" : "잠금"} onClick={() => patch(b.id, { locked: !b.locked } as Partial<Block>)} className="px-0.5 text-muted-foreground hover:text-foreground">{b.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

      {/* 우클릭 컨텍스트 메뉴(P1/P2) */}
      {ctxMenu && selectedIds.length > 0 && (
        <div
          className="fixed z-[100] min-w-[168px] rounded-md border bg-popover p-1 text-xs shadow-md"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 180), top: ctxMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CtxItem onClick={() => { duplicateSelected(); setCtxMenu(null); }} label="복제" kbd="⌘D" />
          <CtxItem onClick={() => { copySelected(); setCtxMenu(null); }} label="복사" kbd="⌘C" />
          {clipboardStore && clipboardStore.length > 0 && (
            <CtxItem onClick={() => { pasteClipboard(); setCtxMenu(null); }} label="붙여넣기" kbd="⌘V" />
          )}
          {selectedIds.length > 1 ? (
            <>
              <CtxItem onClick={() => { groupSelected(); setCtxMenu(null); }} label="그룹" kbd="⌘G" />
              <CtxItem onClick={() => { ungroupSelected(); setCtxMenu(null); }} label="그룹 해제" />
            </>
          ) : (
            <>
              <CtxItem onClick={() => { zOrder("front"); setCtxMenu(null); }} label="맨 앞으로" />
              <CtxItem onClick={() => { zOrder("back"); setCtxMenu(null); }} label="맨 뒤로" />
            </>
          )}
          <div className="my-1 h-px bg-border" />
          <CtxItem onClick={() => { removeSelected(); setCtxMenu(null); }} label="삭제" kbd="Del" danger />
        </div>
      )}
    </div>
  );
}

// 좌측 도구 레일 버튼(캔바식)
function RailTool({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-12 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] transition-colors ${
        active ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}

function CtxItem({ onClick, label, kbd, danger }: { onClick: () => void; label: string; kbd?: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-6 rounded px-2 py-1.5 text-left hover:bg-accent ${danger ? "text-red-600" : ""}`}
    >
      <span>{label}</span>
      {kbd && <span className="font-mono text-[10px] text-muted-foreground">{kbd}</span>}
    </button>
  );
}

// 속성 그룹(목업 .pgroup: 상단 구분선 + 라벨 + 내용)
function Group({ title, children, first }: { title: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <div className={`py-3 ${first ? "" : "border-t"}`}>
      <div className="ed-grouplabel">{title}</div>
      {children}
    </div>
  );
}

// 알약형 숫자 필드(목업 .field: k 라벨 + 입력 + 단위)
function Field({
  k, value, onChange, unit, step, className = "",
}: {
  k?: ReactNode; value: number; onChange: (v: number) => void; unit?: string; step?: number; className?: string;
}) {
  return (
    <div className={`ed-field ${className}`}>
      {k && <span className="k">{k}</span>}
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {unit && <span className="u">{unit}</span>}
    </div>
  );
}

// 라벨이 위에 붙는 필드(텍스트 속성용)
function LabeledField({
  label, value, onChange, unit, step, className = "",
}: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; className?: string;
}) {
  return (
    <div className={className}>
      <div className="ed-grouplabel">{label}{unit ? ` (${unit})` : ""}</div>
      <Field value={value} onChange={onChange} unit={unit} step={step} />
    </div>
  );
}

// 슬라이더(목업 .slider: 라벨 + range + 값)
function Slider({
  label, value, onChange, min, max, display,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; display: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[#2563eb]" />
      <span className="w-9 text-right font-mono text-[10px] text-muted-foreground">{display}</span>
    </div>
  );
}

// 텍스트 서식 툴바(E2.3) — 인라인 에디터(activeEditor)에 연결. 트랜잭션마다 active 갱신.
function FmtToolbar({ editor }: { editor: Editor | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const update = () => force((n) => n + 1);
    editor.on("transaction", update);
    return () => { editor.off("transaction", update); };
  }, [editor]);
  const btn = (label: string, run: () => void, active?: boolean) => (
    <button
      type="button"
      disabled={!editor}
      onClick={run}
      className={`rounded border px-2 py-1 text-xs ${active ? "border-[#2563eb] bg-[#2563eb] text-white" : "hover:bg-accent"} disabled:opacity-40`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1">
      {btn("B", () => editor?.chain().focus().toggleBold().run(), editor?.isActive("bold"))}
      {btn("I", () => editor?.chain().focus().toggleItalic().run(), editor?.isActive("italic"))}
      {btn("H2", () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive("heading", { level: 2 }))}
      {btn("H3", () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), editor?.isActive("heading", { level: 3 }))}
      {btn("• 목록", () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive("bulletList"))}
      {btn("1. 목록", () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive("orderedList"))}
      {btn("인용", () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive("blockquote"))}
    </div>
  );
}

// 툴바 드롭다운(정렬/레이어) 메뉴 항목
function MenuBtn({ onClick, children, block }: { onClick: () => void; children: ReactNode; block?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-left text-xs hover:bg-accent ${block ? "block w-full" : ""}`}
    >
      {children}
    </button>
  );
}

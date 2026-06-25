"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type ChangeEvent as ReactChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ComposedBlockBody } from "@/components/public/composed-page";
import {
  type Block,
  type PageLayout,
  type ImageBlock,
  type TextBlock,
  LAYOUT_BASE_WIDTH,
} from "@/types/magazine-layout";
import { updatePageLayout } from "@/actions/page-actions";
import { uploadBlogImage } from "@/lib/upload-client";
import { FocusPicker } from "@/components/admin/focus-picker";

const BASE_W = LAYOUT_BASE_WIDTH; // 440
const BASE_H = Math.round((BASE_W * 3) / 2); // 660

const COLORS = ["#ffffff", "rgba(255,255,255,0.85)", "#c4a35a", "#1f6f72", "#1c1b1b"];

function uid() {
  return "b" + Math.random().toString(36).slice(2, 9);
}


type ArticleOpt = {
  id: string;
  title: string;
  genre?: string | null;
  subCategory?: string | null;
};

export function PageEditor({
  magazineId,
  pageId,
  pageNumber,
  totalPages,
  initialLayout,
  initialArticleId,
  articles,
  embedded = false,
}: {
  magazineId: string;
  pageId: string;
  pageNumber: number;
  totalPages?: number; // 툴바 "페이지 N / M" 표기용
  initialLayout: PageLayout;
  initialArticleId: string | null;
  articles: ArticleOpt[];
  embedded?: boolean; // 단일 에디터 셸에 임베드 시 '← 매거진' 백링크 숨김
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>(initialLayout.blocks ?? []);
  const [pageBg, setPageBg] = useState(initialLayout.pageBg ?? "#ffffff");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(initialArticleId);
  const [uploading, setUploading] = useState(false);
  const [ratioLock, setRatioLock] = useState(false); // 비율 잠금(W/H 동시 변경)
  // 저장 상태(E2.6): idle(초기) → dirty(변경) → saving → saved
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), 0);

  function patch(id: string, p: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b))
    );
  }

  function addText() {
    const b: TextBlock = {
      id: uid(), type: "text", x: 10, y: 10, w: 60, h: 14, z: maxZ + 1,
      html: "텍스트를 입력하세요", color: "#1c1b1b", fontSizePx: 16, align: "left",
    };
    setBlocks((p) => [...p, b]);
    setSelectedId(b.id);
  }
  function addImage() {
    const b: ImageBlock = {
      id: uid(), type: "image", x: 10, y: 10, w: 50, h: 38, z: maxZ + 1,
      src: "", fit: "cover",
    };
    setBlocks((p) => [...p, b]);
    setSelectedId(b.id);
  }
  // 이미지 프레임: 원본 비율 유지(contain) 자리표시 — 이미지를 채워넣는 틀
  function addImageFrame() {
    const b: ImageBlock = {
      id: uid(), type: "image", x: 10, y: 10, w: 44, h: 44, z: maxZ + 1,
      src: "", fit: "contain", radius: 4,
    };
    setBlocks((p) => [...p, b]);
    setSelectedId(b.id);
  }
  function removeSelected() {
    if (!selectedId) return;
    setBlocks((p) => p.filter((b) => b.id !== selectedId));
    setSelectedId(null);
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

  // ── 드래그 이동 / 8방향 리사이즈 (pointer capture) + 스냅 가이드 ──
  const [snap, setSnap] = useState<{ v: number | null; h: number | null }>({
    v: null,
    h: null,
  });
  const drag = useRef<{
    mode: "move" | "resize";
    id: string;
    sx: number; sy: number;
    bx: number; by: number; bw: number; bh: number;
    dx?: -1 | 0 | 1; // 리사이즈 방향(가로)
    dy?: -1 | 0 | 1; // 리사이즈 방향(세로)
  } | null>(null);

  const SNAP = 1.5; // % 스냅 임계
  const SNAP_TARGETS = [0, 50, 100];
  // 이동 시 좌/중앙/우(상/중앙/하)를 캔버스 0·50·100에 스냅 + 가이드 표시
  function snapMove(nx: number, ny: number, bw: number, bh: number) {
    let gv: number | null = null;
    let gh: number | null = null;
    for (const t of SNAP_TARGETS) {
      if (Math.abs(nx - t) < SNAP) { nx = t; gv = t; break; }
      if (Math.abs(nx + bw / 2 - t) < SNAP) { nx = t - bw / 2; gv = t; break; }
      if (Math.abs(nx + bw - t) < SNAP) { nx = t - bw; gv = t; break; }
    }
    for (const t of SNAP_TARGETS) {
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
    setSelectedId(b.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: "move", id: b.id, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, bw: b.w, bh: b.h };
  }
  function onHandlePointerDown(
    e: ReactPointerEvent,
    b: Block,
    dx: -1 | 0 | 1,
    dy: -1 | 0 | 1,
  ) {
    e.stopPropagation();
    setSelectedId(b.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode: "resize", id: b.id, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, bw: b.w, bh: b.h, dx, dy };
  }
  function onDragMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { w, h } = rectWH();
    const dxPct = ((e.clientX - d.sx) / w) * 100;
    const dyPct = ((e.clientY - d.sy) / h) * 100;

    if (d.mode === "move") {
      let nx = Math.max(0, Math.min(100 - d.bw, d.bx + dxPct));
      let ny = Math.max(0, Math.min(100 - d.bh, d.by + dyPct));
      const s = snapMove(nx, ny, d.bw, d.bh);
      nx = Math.max(0, Math.min(100 - d.bw, s.nx));
      ny = Math.max(0, Math.min(100 - d.bh, s.ny));
      setSnap({ v: s.gv, h: s.gh });
      patch(d.id, { x: nx, y: ny });
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
    patch(d.id, { x: nx, y: ny, w: Math.max(4, nw), h: Math.max(3, nh) });
  }
  function onDragEnd() {
    drag.current = null;
    setSnap({ v: null, h: null });
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

  const round = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="flex gap-4">
      {/* 가운데 컬럼: 툴바 + 캔버스 (목업 .col.center) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
      {/* 캔버스 툴바 (목업 .canvas-toolbar): 추가 · 실행취소/다시실행 · 정렬/레이어 · 페이지/줌 */}
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-card px-3 py-2">
        {!embedded && (
          <Link
            href={`/admin/magazines/${magazineId}/edit`}
            className="mr-1 text-sm text-muted-foreground hover:underline"
          >
            ←
          </Link>
        )}
        <button type="button" onClick={addText} className="tbtn">＋ 텍스트</button>
        <button type="button" onClick={addImage} className="tbtn">＋ 이미지</button>
        <button type="button" onClick={addImageFrame} className="tbtn">＋ 이미지 프레임</button>
        <span className="tbsep" />
        <button type="button" disabled title="실행취소(준비 중)" className="tbtn ghost">↶ 실행취소</button>
        <button type="button" disabled title="다시실행(준비 중)" className="tbtn ghost">↷ 다시실행</button>
        <span className="tbsep" />
        {/* 정렬 ▾ */}
        <details className="relative">
          <summary className={`tbtn ghost list-none ${!selected ? "pointer-events-none opacity-40" : ""}`}>정렬 ▾</summary>
          <div className="absolute left-0 z-30 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
            <div className="grid grid-cols-3 gap-1">
              <MenuBtn onClick={() => alignH("left")}>⇤ 좌</MenuBtn>
              <MenuBtn onClick={() => alignH("center")}>⤬ 가운데</MenuBtn>
              <MenuBtn onClick={() => alignH("right")}>⇥ 우</MenuBtn>
              <MenuBtn onClick={() => alignV("top")}>⤒ 상</MenuBtn>
              <MenuBtn onClick={() => alignV("middle")}>↕ 중앙</MenuBtn>
              <MenuBtn onClick={() => alignV("bottom")}>⤓ 하</MenuBtn>
            </div>
          </div>
        </details>
        {/* 레이어 ▾ */}
        <details className="relative">
          <summary className={`tbtn ghost list-none ${!selected ? "pointer-events-none opacity-40" : ""}`}>레이어 ▾</summary>
          <div className="absolute left-0 z-30 mt-1 w-32 rounded-md border bg-popover p-1 shadow-md">
            <MenuBtn onClick={() => zOrder("front")} block>맨 앞으로</MenuBtn>
            <MenuBtn onClick={() => zOrder("forward")} block>앞으로</MenuBtn>
            <MenuBtn onClick={() => zOrder("backward")} block>뒤로</MenuBtn>
            <MenuBtn onClick={() => zOrder("back")} block>맨 뒤로</MenuBtn>
          </div>
        </details>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-muted-foreground">
            페이지 {pageNumber}{totalPages ? ` / ${totalPages}` : ""} · 100%
          </span>
          <span className="tbsep" />
          <select
            value={articleId ?? ""}
            onChange={(e) => setArticleId(e.target.value || null)}
            className="max-w-[160px] rounded-md border px-2 py-1.5 text-xs"
            title="싣는 기사 연동"
          >
            <option value="">기사 연동 없음</option>
            {articles.map((a) => {
              const tag = a.genre || a.subCategory;
              return (
                <option key={a.id} value={a.id}>
                  {tag ? `[${tag}] ` : ""}
                  {a.title}
                </option>
              );
            })}
          </select>
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

      {/* 캔버스 래핑 (목업 .canvas-wrap): 중립 배경 + 강한 그림자 */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-[#e9e7e4] p-8">
        <div
          ref={canvasRef}
          onPointerDown={() => setSelectedId(null)}
          className="relative shrink-0 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.18)]"
          style={{ width: BASE_W, height: BASE_H, background: pageBg, touchAction: "none" }}
        >
          {[...blocks].sort((a, b) => a.z - b.z).map((b) => {
            const isSel = b.id === selectedId;
            const isEmptyImg = b.type === "image" && !b.src;
            return (
              <div
                key={b.id}
                onPointerDown={(e) => onBlockPointerDown(e, b)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                style={{
                  position: "absolute",
                  left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`,
                  transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                  opacity: b.opacity ?? 1,
                  zIndex: b.z,
                  outline: isSel ? "1.5px solid #2563eb" : "1px dashed rgba(0,0,0,.25)",
                  cursor: "move",
                }}
              >
                {isEmptyImg ? (
                  <div className="pointer-events-none flex h-full w-full items-center justify-center bg-gray-100 text-center text-[10px] leading-tight text-gray-400">
                    이미지 없음
                    <br />
                    우측 패널에서 업로드
                  </div>
                ) : (
                  <ComposedBlockBody block={b} />
                )}
                {isSel &&
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
        </div>
        </div>
      </div>

        {/* 속성 패널 (목업 .col.right · .props) */}
        <aside className="w-64 shrink-0 self-start rounded-lg border bg-card p-3.5 text-sm">
          {!selected ? (
            <div>
              <h4 className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                속성
              </h4>
              <p className="text-xs text-muted-foreground">
                블록을 선택하면 속성이 표시됩니다.
              </p>
              <div className="mt-3 border-t pt-3">
                <div className="ed-grouplabel">페이지 배경색</div>
                <div className="ed-field">
                  <span className="k">#</span>
                  <input value={pageBg.replace(/^#/, "")} onChange={(e) => setPageBg("#" + e.target.value.replace(/^#/, ""))} />
                </div>
                <div className="mt-2 flex gap-1.5">
                  {["#ffffff", "#faf7f2", "#111111", "#000000"].map((c) => (
                    <button key={c} type="button" onClick={() => setPageBg(c)} className="h-6 w-6 rounded border" style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* 헤더: 속성 [typetag] */}
              <h4 className="mb-2.5 flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">속성</span>
                <span className="ed-typetag">{selected.type === "image" ? "이미지 블록" : "텍스트 블록"}</span>
                <button type="button" onClick={removeSelected} className="ml-auto rounded border px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">삭제</button>
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
                    {ratioLock ? "🔒" : "🔓"} 비율
                  </button>
                  <Field className="flex-1" k="∠" unit="°" value={selected.rotation ?? 0} onChange={(v) => patch(selected.id, { rotation: v })} />
                  <Field className="flex-1" k="◐" unit="%" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(v) => patch(selected.id, { opacity: v / 100 })} />
                </div>
              </Group>

              {/* 정렬(캔버스 기준) */}
              <Group title="정렬">
                <div className="ed-iconrow flex gap-1.5">
                  <button type="button" onClick={() => alignH("left")} title="왼쪽">⇤</button>
                  <button type="button" onClick={() => alignH("center")} title="가로 가운데">⤬</button>
                  <button type="button" onClick={() => alignH("right")} title="오른쪽">⇥</button>
                  <button type="button" onClick={() => alignV("top")} title="위">⤒</button>
                  <button type="button" onClick={() => alignV("middle")} title="세로 가운데">↕</button>
                  <button type="button" onClick={() => alignV("bottom")} title="아래">⤓</button>
                </div>
              </Group>

              {/* 레이어 (z-order) */}
              <Group title="레이어 (z-order)">
                <div className="ed-iconrow flex gap-1.5">
                  <button type="button" onClick={() => zOrder("front")} title="맨 앞으로">⤴ 맨앞</button>
                  <button type="button" onClick={() => zOrder("forward")} title="앞으로">앞으로</button>
                  <button type="button" onClick={() => zOrder("backward")} title="뒤로">뒤로</button>
                  <button type="button" onClick={() => zOrder("back")} title="맨 뒤로">⤵ 맨뒤</button>
                </div>
              </Group>

              {selected.type === "image" ? (
                <Group title="이미지 프레임">
                  <div className="mb-2">
                    <div className="ed-grouplabel">이미지 파일 (업로드 / 교체)</div>
                    <input type="file" accept="image/*" onChange={(e) => handleFileFor(selected.id, e)} className="block w-full text-xs" />
                    {uploading && <p className="mt-1 text-xs text-gray-500">업로드 중...</p>}
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
              ) : (
                <Group title="텍스트">
                  <div className="mb-2">
                    <div className="ed-grouplabel">내용 (HTML 허용)</div>
                    <textarea value={selected.html} onChange={(e) => patch(selected.id, { html: e.target.value } as Partial<TextBlock>)} rows={4} className="w-full rounded-md border px-2 py-1.5 text-xs" />
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
        </aside>
    </div>
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
  k?: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; className?: string;
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

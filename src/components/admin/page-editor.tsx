"use client";

import {
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ratioLock, setRatioLock] = useState(false); // 비율 잠금(W/H 동시 변경)

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

  function save() {
    setSaving(true);
    const layout: PageLayout = { blocks, pageBg };
    updatePageLayout(pageId, magazineId, layout, articleId)
      .then(() => {
        toast.success("저장되었습니다");
        router.refresh();
      })
      .catch(() => toast.error("저장 실패"))
      .finally(() => setSaving(false));
  }

  const round = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="space-y-4">
      {/* 캔버스 툴바 (목업): 추가 · 실행취소/다시실행 · 정렬/레이어 · 페이지/줌 · 저장 */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
        {!embedded && (
          <Link
            href={`/admin/magazines/${magazineId}/edit`}
            className="mr-1 text-sm text-muted-foreground hover:underline"
          >
            ←
          </Link>
        )}
        <button type="button" onClick={addText} className="rounded px-2.5 py-1 text-sm hover:bg-accent">＋ 텍스트</button>
        <button type="button" onClick={addImage} className="rounded px-2.5 py-1 text-sm hover:bg-accent">＋ 이미지</button>
        <button type="button" onClick={addImageFrame} className="rounded px-2.5 py-1 text-sm hover:bg-accent">＋ 이미지 프레임</button>
        <div className="mx-1 h-5 w-px bg-border" />
        <button type="button" disabled title="실행취소(준비 중)" className="rounded px-2 py-1 text-sm text-muted-foreground/50">↶</button>
        <button type="button" disabled title="다시실행(준비 중)" className="rounded px-2 py-1 text-sm text-muted-foreground/50">↷</button>
        <div className="mx-1 h-5 w-px bg-border" />
        {/* 정렬 ▾ */}
        <details className="relative">
          <summary className={`cursor-pointer rounded px-2.5 py-1 text-sm hover:bg-accent ${!selected ? "pointer-events-none text-muted-foreground/50" : ""}`}>정렬 ▾</summary>
          <div className="absolute left-0 z-30 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md">
            <div className="grid grid-cols-3 gap-1">
              <MenuBtn onClick={() => alignH("left")}>⬅ 좌</MenuBtn>
              <MenuBtn onClick={() => alignH("center")}>↔ 가운데</MenuBtn>
              <MenuBtn onClick={() => alignH("right")}>➡ 우</MenuBtn>
              <MenuBtn onClick={() => alignV("top")}>⬆ 상</MenuBtn>
              <MenuBtn onClick={() => alignV("middle")}>↕ 중앙</MenuBtn>
              <MenuBtn onClick={() => alignV("bottom")}>⬇ 하</MenuBtn>
            </div>
          </div>
        </details>
        {/* 레이어 ▾ */}
        <details className="relative">
          <summary className={`cursor-pointer rounded px-2.5 py-1 text-sm hover:bg-accent ${!selected ? "pointer-events-none text-muted-foreground/50" : ""}`}>레이어 ▾</summary>
          <div className="absolute left-0 z-30 mt-1 w-32 rounded-md border bg-popover p-1 shadow-md">
            <MenuBtn onClick={() => zOrder("front")} block>맨 앞으로</MenuBtn>
            <MenuBtn onClick={() => zOrder("forward")} block>앞으로</MenuBtn>
            <MenuBtn onClick={() => zOrder("backward")} block>뒤로</MenuBtn>
            <MenuBtn onClick={() => zOrder("back")} block>맨 뒤로</MenuBtn>
          </div>
        </details>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            페이지 {pageNumber}{totalPages ? ` / ${totalPages}` : ""}
          </span>
          <span className="tabular-nums">100%</span>
          <div className="h-5 w-px bg-border" />
          <select
            value={articleId ?? ""}
            onChange={(e) => setArticleId(e.target.value || null)}
            className="max-w-[160px] rounded border px-2 py-1 text-xs"
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
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* 캔버스 (가운데, 중앙 정렬) */}
        <div className="flex min-w-0 flex-1 justify-center">
        <div
          ref={canvasRef}
          onPointerDown={() => setSelectedId(null)}
          className="relative shrink-0 overflow-hidden border shadow-sm"
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

        {/* 속성 패널 (목업 우측 256px · 그룹 섹션) */}
        <aside className="w-64 shrink-0 self-start rounded-lg border bg-card text-sm">
          {!selected ? (
            <div className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                속성
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                블록을 선택하면 속성이 표시됩니다.
              </p>
              <div className="mt-4 space-y-2 border-t pt-4">
                <label className="block text-xs font-medium text-gray-600">페이지 배경색</label>
                <input type="text" value={pageBg} onChange={(e) => setPageBg(e.target.value)} className="w-full rounded border px-2 py-1" />
                <div className="flex gap-1">
                  {["#ffffff", "#faf7f2", "#111111", "#000000"].map((c) => (
                    <button key={c} type="button" onClick={() => setPageBg(c)} className="h-6 w-6 rounded border" style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  속성 · {selected.type === "image" ? "이미지 블록" : "텍스트 블록"}
                </span>
                <button type="button" onClick={removeSelected} className="rounded border px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">삭제</button>
              </div>

              {/* 위치 · 크기 */}
              <Section title="위치 · 크기 (상대 단위)">
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="X %" value={round(selected.x)} onChange={(v) => patch(selected.id, { x: v })} />
                  <NumField label="Y %" value={round(selected.y)} onChange={(v) => patch(selected.id, { y: v })} />
                  <NumField label="W %" value={round(selected.w)} onChange={(v) => patchSize("w", v)} />
                  <NumField label="H %" value={round(selected.h)} onChange={(v) => patchSize("h", v)} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRatioLock((v) => !v)}
                    className={`rounded border px-2 py-1 text-xs ${ratioLock ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  >
                    {ratioLock ? "🔒" : "🔓"} 비율
                  </button>
                  <NumField className="flex-1" label="회전 °" value={selected.rotation ?? 0} onChange={(v) => patch(selected.id, { rotation: v })} />
                  <NumField className="flex-1" label="투명도 %" value={Math.round((selected.opacity ?? 1) * 100)} onChange={(v) => patch(selected.id, { opacity: v / 100 })} />
                </div>
              </Section>

              {/* 정렬(캔버스 기준) */}
              <Section title="정렬">
                <div className="grid grid-cols-6 gap-1">
                  <IconBtn onClick={() => alignH("left")} title="왼쪽">⬅</IconBtn>
                  <IconBtn onClick={() => alignH("center")} title="가로 가운데">↔</IconBtn>
                  <IconBtn onClick={() => alignH("right")} title="오른쪽">➡</IconBtn>
                  <IconBtn onClick={() => alignV("top")} title="위">⬆</IconBtn>
                  <IconBtn onClick={() => alignV("middle")} title="세로 가운데">↕</IconBtn>
                  <IconBtn onClick={() => alignV("bottom")} title="아래">⬇</IconBtn>
                </div>
              </Section>

              {/* 레이어 (z-order) */}
              <Section title="레이어 (z-order)">
                <div className="grid grid-cols-4 gap-1">
                  <IconBtn onClick={() => zOrder("front")} title="맨 앞으로">⤒</IconBtn>
                  <IconBtn onClick={() => zOrder("forward")} title="앞으로">↑</IconBtn>
                  <IconBtn onClick={() => zOrder("backward")} title="뒤로">↓</IconBtn>
                  <IconBtn onClick={() => zOrder("back")} title="맨 뒤로">⤓</IconBtn>
                </div>
              </Section>

              {selected.type === "image" ? (
                <Section title="이미지 프레임">
                  <div className="space-y-1">
                    <span className="block text-[11px] font-medium text-gray-600">이미지 파일 (업로드 / 교체)</span>
                    <input type="file" accept="image/*" onChange={(e) => handleFileFor(selected.id, e)} className="block w-full text-xs" />
                  </div>
                  {uploading && <p className="text-xs text-gray-500">업로드 중...</p>}
                  {/* 채움 / 맞춤 세그먼트 */}
                  <div className="grid grid-cols-2 overflow-hidden rounded-md border text-xs">
                    {(["cover", "contain"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => patch(selected.id, { fit: f } as Partial<ImageBlock>)}
                        className={`py-1 ${(selected.fit ?? "cover") === f ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                      >
                        {f === "cover" ? "채움(crop)" : "맞춤(contain)"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="어둡게 %" value={selected.overlayDarken ?? 0} onChange={(v) => patch(selected.id, { overlayDarken: v } as Partial<ImageBlock>)} />
                    <NumField label="모서리 px" value={selected.radius ?? 0} onChange={(v) => patch(selected.id, { radius: v } as Partial<ImageBlock>)} />
                  </div>
                  {selected.src && (selected.fit ?? "cover") === "cover" && (
                    <FocusPicker
                      src={selected.src}
                      focusX={selected.focusX ?? 50}
                      focusY={selected.focusY ?? 50}
                      zoom={selected.zoom ?? 1}
                      onChange={(x, y) => patch(selected.id, { focusX: x, focusY: y } as Partial<ImageBlock>)}
                      onZoomChange={(z) => patch(selected.id, { zoom: z } as Partial<ImageBlock>)}
                    />
                  )}
                </Section>
              ) : (
                <Section title="텍스트">
                  <label className="block text-[11px] font-medium text-gray-600">내용 (HTML 허용)
                    <textarea value={selected.html} onChange={(e) => patch(selected.id, { html: e.target.value } as Partial<TextBlock>)} rows={4} className="mt-1 w-full rounded border px-2 py-1 text-xs" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="글자 크기 px" value={selected.fontSizePx ?? 16} onChange={(v) => patch(selected.id, { fontSizePx: v } as Partial<TextBlock>)} />
                    <label className="text-[11px] text-muted-foreground">정렬
                      <select value={selected.align ?? "left"} onChange={(e) => patch(selected.id, { align: e.target.value as "left" | "center" | "right" } as Partial<TextBlock>)} className="mt-0.5 block w-full rounded border px-1 py-0.5 text-foreground">
                        <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
                      </select>
                    </label>
                    <NumField label="굵기" value={selected.weight ?? 400} step={100} onChange={(v) => patch(selected.id, { weight: v } as Partial<TextBlock>)} />
                    <NumField label="줄간격" value={selected.lineHeight ?? 1.6} step={0.05} onChange={(v) => patch(selected.id, { lineHeight: v } as Partial<TextBlock>)} />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">글자색</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => patch(selected.id, { color: c } as Partial<TextBlock>)} className={`h-6 w-6 rounded-full border ${selected.color === c ? "ring-2 ring-gray-900 ring-offset-1" : ""}`} style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 text-[11px] text-muted-foreground">배경색(빈칸=없음)
                      <input type="text" value={selected.bgColor ?? ""} onChange={(e) => patch(selected.id, { bgColor: e.target.value || undefined } as Partial<TextBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5 text-foreground" />
                    </label>
                    <NumField className="w-20" label="여백 px" value={selected.padding ?? 0} onChange={(v) => patch(selected.id, { padding: v } as Partial<TextBlock>)} />
                  </div>
                </Section>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// 속성 그룹 섹션(라벨 + 내용)
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

// 라벨 달린 숫자 입력
function NumField({
  label, value, onChange, step, className = "",
}: {
  label: string; value: number; onChange: (v: number) => void; step?: number; className?: string;
}) {
  return (
    <label className={`text-[11px] text-muted-foreground ${className}`}>
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded border px-1 py-0.5 text-foreground"
      />
    </label>
  );
}

// 정렬/레이어 아이콘 버튼
function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 items-center justify-center rounded border text-sm hover:bg-accent"
    >
      {children}
    </button>
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

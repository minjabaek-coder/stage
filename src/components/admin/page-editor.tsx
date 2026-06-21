"use client";

import {
  useRef,
  useState,
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

const BASE_W = LAYOUT_BASE_WIDTH; // 440
const BASE_H = Math.round((BASE_W * 3) / 2); // 660

const COLORS = ["#ffffff", "rgba(255,255,255,0.85)", "#c4a35a", "#1f6f72", "#1c1b1b"];

function uid() {
  return "b" + Math.random().toString(36).slice(2, 9);
}

type ArticleOpt = { id: string; title: string; section: string };

export function PageEditor({
  magazineId,
  pageId,
  pageNumber,
  initialLayout,
  initialArticleId,
  articles,
}: {
  magazineId: string;
  pageId: string;
  pageNumber: number;
  initialLayout: PageLayout;
  initialArticleId: string | null;
  articles: ArticleOpt[];
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>(initialLayout.blocks ?? []);
  const [pageBg, setPageBg] = useState(initialLayout.pageBg ?? "#ffffff");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(initialArticleId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
  function removeSelected() {
    if (!selectedId) return;
    setBlocks((p) => p.filter((b) => b.id !== selectedId));
    setSelectedId(null);
  }

  // ── 드래그 이동 / 리사이즈 (pointer capture) ──
  const drag = useRef<{
    mode: "move" | "resize";
    id: string;
    sx: number; sy: number;
    bx: number; by: number; bw: number; bh: number;
  } | null>(null);

  function rectWH() {
    const r = canvasRef.current?.getBoundingClientRect();
    return { w: r?.width || BASE_W, h: r?.height || BASE_H };
  }

  function onBlockPointerDown(e: ReactPointerEvent, b: Block) {
    e.stopPropagation();
    setSelectedId(b.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode: "move", id: b.id, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, bw: b.w, bh: b.h };
  }
  function onHandlePointerDown(e: ReactPointerEvent, b: Block) {
    e.stopPropagation();
    setSelectedId(b.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode: "resize", id: b.id, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, bw: b.w, bh: b.h };
  }
  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { w, h } = rectWH();
    const dxPct = ((e.clientX - d.sx) / w) * 100;
    const dyPct = ((e.clientY - d.sy) / h) * 100;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    if (d.mode === "move") {
      patch(d.id, { x: clamp(d.bx + dxPct), y: clamp(d.by + dyPct) });
    } else {
      patch(d.id, {
        w: Math.max(4, Math.min(100 - d.bx, d.bw + dxPct)),
        h: Math.max(3, Math.min(100 - d.by, d.bh + dyPct)),
      });
    }
  }
  function onPointerUp() {
    drag.current = null;
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);
  function triggerUpload(blockId: string) {
    uploadTarget.current = blockId;
    fileRef.current?.click();
  }
  async function handleFile(e: ReactChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTarget.current;
    e.target.value = "";
    if (!file || !id) return;
    setUploading(true);
    try {
      const url = await uploadBlogImage(file);
      patch(id, { src: url } as Partial<ImageBlock>);
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
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/magazines/${magazineId}/edit`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 매거진
        </Link>
        <span className="text-sm font-semibold">P.{pageNumber} 편집</span>
        <div className="mx-2 h-5 w-px bg-border" />
        <button type="button" onClick={addText} className="rounded border px-3 py-1.5 text-sm hover:bg-accent">+ 텍스트</button>
        <button type="button" onClick={addImage} className="rounded border px-3 py-1.5 text-sm hover:bg-accent">+ 이미지</button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-muted-foreground">기사 연동</label>
          <select
            value={articleId ?? ""}
            onChange={(e) => setArticleId(e.target.value || null)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">없음</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>{a.section ? `[${a.section}] ` : ""}{a.title}</option>
            ))}
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

      <div className="flex flex-wrap gap-6">
        {/* 캔버스 */}
        <div
          ref={canvasRef}
          onPointerDown={() => setSelectedId(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
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
                style={{
                  position: "absolute",
                  left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`,
                  transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                  opacity: b.opacity ?? 1,
                  zIndex: b.z,
                  outline: isSel ? "2px solid #1f6f72" : "1px dashed rgba(0,0,0,.25)",
                  cursor: "move",
                }}
              >
                {isEmptyImg ? (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(b.id);
                      triggerUpload(b.id);
                    }}
                    className="flex h-full w-full items-center justify-center bg-gray-100 text-[11px] text-gray-500 hover:bg-gray-200"
                  >
                    📁 이미지 선택
                  </button>
                ) : (
                  <ComposedBlockBody block={b} />
                )}
                {isSel && (
                  <div
                    onPointerDown={(e) => onHandlePointerDown(e, b)}
                    title="크기 조절"
                    style={{
                      position: "absolute", right: -6, bottom: -6, width: 14, height: 14,
                      background: "#fff", border: "2px solid #1f6f72", borderRadius: 3,
                      cursor: "nwse-resize", zIndex: 999,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 속성 패널 */}
        <div className="min-w-[280px] flex-1 space-y-4 text-sm">
          {!selected ? (
            <div className="rounded-lg border p-4 text-muted-foreground">
              <p>블록을 선택하면 속성이 표시됩니다.</p>
              <div className="mt-4 space-y-2">
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
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{selected.type === "image" ? "이미지 블록" : "텍스트 블록"}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => patch(selected.id, { z: maxZ + 1 })} className="rounded border px-2 py-0.5 text-xs">맨 앞</button>
                  <button type="button" onClick={() => patch(selected.id, { z: 0 })} className="rounded border px-2 py-0.5 text-xs">맨 뒤</button>
                  <button type="button" onClick={removeSelected} className="rounded border px-2 py-0.5 text-xs text-red-600">삭제</button>
                </div>
              </div>

              {/* 위치/크기 */}
              <div className="grid grid-cols-4 gap-2">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="text-xs">
                    {k.toUpperCase()}%
                    <input type="number" value={round((selected as Block)[k])} onChange={(e) => patch(selected.id, { [k]: Number(e.target.value) } as Partial<Block>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">회전°
                  <input type="number" value={selected.rotation ?? 0} onChange={(e) => patch(selected.id, { rotation: Number(e.target.value) })} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                </label>
                <label className="text-xs">투명도%
                  <input type="number" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)} onChange={(e) => patch(selected.id, { opacity: Number(e.target.value) / 100 })} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                </label>
              </div>

              {selected.type === "image" ? (
                <div className="space-y-3 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => triggerUpload(selected.id)}
                    className="rounded border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    📁 이미지 업로드 / 교체
                  </button>
                  {uploading && <p className="text-xs text-gray-500">업로드 중...</p>}
                  <div className="flex gap-2">
                    <label className="text-xs">맞춤
                      <select value={selected.fit ?? "cover"} onChange={(e) => patch(selected.id, { fit: e.target.value as "cover" | "contain" } as Partial<ImageBlock>)} className="mt-0.5 block w-full rounded border px-1 py-0.5">
                        <option value="cover">채우기(크롭)</option>
                        <option value="contain">원본 비율</option>
                      </select>
                    </label>
                    <label className="text-xs">어둠%
                      <input type="number" min={0} max={90} value={selected.overlayDarken ?? 0} onChange={(e) => patch(selected.id, { overlayDarken: Number(e.target.value) } as Partial<ImageBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                    <label className="text-xs">라운드
                      <input type="number" min={0} value={selected.radius ?? 0} onChange={(e) => patch(selected.id, { radius: Number(e.target.value) } as Partial<ImageBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t pt-3">
                  <label className="block text-xs font-medium text-gray-600">내용 (HTML 허용)
                    <textarea value={selected.html} onChange={(e) => patch(selected.id, { html: e.target.value } as Partial<TextBlock>)} rows={4} className="mt-1 w-full rounded border px-2 py-1 text-xs" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">글자 크기(px)
                      <input type="number" value={selected.fontSizePx ?? 16} onChange={(e) => patch(selected.id, { fontSizePx: Number(e.target.value) } as Partial<TextBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                    <label className="text-xs">정렬
                      <select value={selected.align ?? "left"} onChange={(e) => patch(selected.id, { align: e.target.value as "left" | "center" | "right" } as Partial<TextBlock>)} className="mt-0.5 block w-full rounded border px-1 py-0.5">
                        <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
                      </select>
                    </label>
                    <label className="text-xs">굵기
                      <input type="number" step={100} min={100} max={900} value={selected.weight ?? 400} onChange={(e) => patch(selected.id, { weight: Number(e.target.value) } as Partial<TextBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                    <label className="text-xs">줄간격
                      <input type="number" step={0.05} value={selected.lineHeight ?? 1.6} onChange={(e) => patch(selected.id, { lineHeight: Number(e.target.value) } as Partial<TextBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">글자색</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => patch(selected.id, { color: c } as Partial<TextBlock>)} className={`h-6 w-6 rounded-full border ${selected.color === c ? "ring-2 ring-gray-900 ring-offset-1" : ""}`} style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <label className="text-xs flex-1">배경색(빈칸=없음)
                      <input type="text" value={selected.bgColor ?? ""} onChange={(e) => patch(selected.id, { bgColor: e.target.value || undefined } as Partial<TextBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                    <label className="text-xs w-20">여백(px)
                      <input type="number" value={selected.padding ?? 0} onChange={(e) => patch(selected.id, { padding: Number(e.target.value) } as Partial<TextBlock>)} className="mt-0.5 w-full rounded border px-1 py-0.5" />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

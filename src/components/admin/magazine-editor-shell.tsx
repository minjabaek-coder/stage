"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ComposedPage } from "@/components/public/composed-page";
import { PageEditor } from "@/components/admin/page-editor";
import { parsePageLayout } from "@/types/magazine-layout";
import {
  createComposedPage,
  duplicatePage,
  deletePage,
  reorderPages,
  generateDraftFromArticle,
} from "@/actions/page-actions";

import { ArticlePicker, type ArticleOpt, type Placement } from "@/components/admin/article-picker";

type PageItem = {
  id: string;
  pageNumber: number;
  layout: unknown;
  articleId: string | null;
};

// 단일 에디터 셸(E1): 좌측 페이지 썸네일 패널 + 우측 활성 페이지 편집기.
// 라우트 전환 없이 페이지를 스위칭 — "콘텐츠 단위 다중 페이지 관리"(에디터 목업).
export function MagazineEditorShell({
  magazineId,
  pages,
  articles,
}: {
  magazineId: string;
  pages: PageItem[];
  articles: ArticleOpt[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<PageItem[]>(pages);
  const [selectedId, setSelectedId] = useState<string | null>(
    pages[0]?.id ?? null,
  );
  const [pending, start] = useTransition();
  const [draftArticleId, setDraftArticleId] = useState("");
  const dndId = useId();

  // 서버 refresh로 pages가 갱신되면 items 동기화(낙관적 업데이트 후 정합).
  // 선택은 렌더에서 파생(유효치 않으면 첫 페이지 폴백)하므로 여기선 items만.
  useEffect(() => {
    setItems(pages);
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(reordered: PageItem[]) {
    setItems(reordered);
    start(async () => {
      await reorderPages(
        magazineId,
        reordered.map((p) => p.id),
      );
      router.refresh();
    });
  }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persist(arrayMove(items, oldIndex, newIndex));
  }
  function move(index: number, dir: -1 | 1) {
    const t = index + dir;
    if (t < 0 || t >= items.length) return;
    persist(arrayMove(items, index, t));
  }
  function addPage() {
    start(async () => {
      // D5: 현재 선택된 페이지 '다음'에 삽입(없으면 맨 끝)
      const r = await createComposedPage(magazineId, { afterPageId: selectedId ?? undefined });
      if (r?.pageId) {
        setSelectedId(r.pageId);
        router.refresh();
        toast.success("새 페이지를 추가했습니다");
      }
    });
  }
  function addAfter(id: string) {
    start(async () => {
      const r = await createComposedPage(magazineId, { afterPageId: id });
      if (r?.pageId) {
        setSelectedId(r.pageId);
        router.refresh();
        toast.success("새 페이지를 추가했습니다");
      }
    });
  }
  // P3-⑤ 기사 → 초안 페이지 자동 생성(현재 페이지 다음에 삽입, 전 페이지 연동).
  function generateDraft() {
    if (!draftArticleId) return;
    const already = items.some((p) => p.articleId === draftArticleId);
    if (
      already &&
      !confirm(
        "이미 이 기사로 만든 페이지가 있습니다. 재생성하면 기존 페이지(수동 편집 포함)가 사라집니다. 계속할까요?",
      )
    )
      return;
    start(async () => {
      const r = await generateDraftFromArticle(magazineId, draftArticleId, {
        afterPageId: selectedId ?? undefined,
        replaceExisting: already,
      });
      if (r && "success" in r && r.success) {
        if (r.pageId) setSelectedId(r.pageId);
        setDraftArticleId("");
        router.refresh();
        toast.success(`기사로 ${r.count}개 페이지 초안을 만들었습니다`);
      } else {
        toast.error(("error" in r && r.error) || "초안 생성 실패");
      }
    });
  }
  function duplicate(id: string) {
    start(async () => {
      const r = await duplicatePage(id);
      if (r && "pageId" in r && r.pageId) {
        setSelectedId(r.pageId);
        router.refresh();
        toast.success("페이지를 복제했습니다");
      } else {
        toast.error("복제 실패");
      }
    });
  }
  function del(id: string) {
    if (!confirm("이 페이지를 삭제하시겠습니까?")) return;
    start(async () => {
      await deletePage(id, magazineId);
      setItems((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) setSelectedId(null); // 렌더 폴백이 첫 페이지로
      router.refresh();
      toast.success("삭제되었습니다");
    });
  }

  // 선택 페이지 파생 — selectedId가 유효치 않으면 첫 페이지로 폴백
  const selected = items.find((p) => p.id === selectedId) ?? items[0] ?? null;
  const selectedIndex = selected
    ? items.findIndex((p) => p.id === selected.id)
    : -1;

  // 이 매거진에서 각 기사가 차지한 연속 페이지 범위(선택기 배치 뱃지·미배치 필터용).
  const placements = useMemo(() => {
    const m: Record<string, Placement> = {};
    for (const p of items) {
      if (!p.articleId) continue;
      const cur = m[p.articleId];
      m[p.articleId] = cur
        ? { start: Math.min(cur.start, p.pageNumber), end: Math.max(cur.end, p.pageNumber) }
        : { start: p.pageNumber, end: p.pageNumber };
    }
    return m;
  }, [items]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 위: 활성 페이지 편집기 (좌 레일·캔버스·속성 — 라우트 전환 없이 key로 스위칭) */}
      <div className="min-h-0 flex-1">
        {selected ? (
          <PageEditor
            key={selected.id}
            magazineId={magazineId}
            pageId={selected.id}
            pageNumber={selectedIndex + 1}
            totalPages={items.length}
            initialLayout={parsePageLayout(selected.layout) ?? { blocks: [] }}
            initialArticleId={selected.articleId}
            articles={articles}
            placements={placements}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            아래에서 페이지를 선택하거나 새로 추가하세요.
          </div>
        )}
      </div>

      {/* 아래: 페이지 스트립 (가로 · PPT/캔바식) */}
      <div className="flex-none rounded-lg border bg-card">
        <div className="flex items-center gap-2 overflow-x-auto p-2.5">
          <span className="flex-none self-stretch pr-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground [writing-mode:initial]">
            페이지 · {items.length}
          </span>
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={horizontalListSortingStrategy}>
              <div className="flex items-center gap-2">
                {items.map((p, i) => (
                  <PageStripItem
                    key={p.id}
                    page={p}
                    index={i}
                    selected={p.id === selectedId}
                    onSelect={() => setSelectedId(p.id)}
                    onMove={(dir) => move(i, dir)}
                    onDelete={() => del(p.id)}
                    onDuplicate={() => duplicate(p.id)}
                    onAddAfter={() => addAfter(p.id)}
                    isFirst={i === 0}
                    isLast={i === items.length - 1}
                    disabled={pending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={addPage}
            disabled={pending}
            title="새 페이지"
            className="flex h-[81px] w-[54px] flex-none items-center justify-center rounded-md border border-dashed text-xl text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            ＋
          </button>

          {/* 기사 → 초안 자동 생성(현재 페이지 다음에 삽입) */}
          <div className="ml-auto flex flex-none items-center gap-1.5 self-stretch border-l pl-2">
            <ArticlePicker
              articles={articles}
              placements={placements}
              value={draftArticleId || null}
              onChange={(id) => setDraftArticleId(id ?? "")}
              disabled={pending}
              placeholder="초안 만들 기사…"
              className="w-[200px]"
            />
            <button
              type="button"
              onClick={generateDraft}
              disabled={pending || !draftArticleId}
              title="선택한 기사 내용을 프리셋 초안 페이지로 생성"
              className="h-8 flex-none rounded-md border border-primary px-2.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-40"
            >
              기사로 초안
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 하단 가로 페이지 스트립 항목(PPT/캔바식): 썸네일 + 쪽번호 + ⋯ 메뉴, 드래그 재정렬
function PageStripItem({
  page,
  index,
  selected,
  onSelect,
  onMove,
  onDelete,
  onDuplicate,
  onAddAfter,
  isFirst,
  isLast,
  disabled,
}: {
  page: PageItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddAfter: () => void;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="group relative flex-none text-center">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`페이지 ${index + 1} 편집`}
        {...attributes}
        {...listeners}
        className={`relative block h-[81px] w-[54px] cursor-pointer touch-none overflow-hidden rounded-md border bg-neutral-900 active:cursor-grabbing ${
          selected ? "border-primary ring-2 ring-primary/30" : "border-line2"
        }`}
      >
        <ComposedPage layout={parsePageLayout(page.layout)} fit="cover" />
      </button>
      <div className={`mt-1 font-mono text-[10px] ${selected ? "text-primary" : "text-muted-foreground"}`}>
        {index + 1}
      </div>
      {/* ⋯ 메뉴 */}
      <details className="absolute right-0.5 top-0.5 hidden group-hover:block">
        <summary className="flex h-4 w-4 cursor-pointer list-none items-center justify-center rounded border bg-white/90 text-[10px] text-muted-foreground">⋯</summary>
        <div className="absolute right-0 z-30 mt-1 w-28 rounded-md border bg-popover p-1 text-[11px] shadow-md">
          <button type="button" onClick={onAddAfter} disabled={disabled} className="block w-full rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-30">＋ 다음에 새 페이지</button>
          <button type="button" onClick={onDuplicate} disabled={disabled} className="block w-full rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-30">⧉ 복제</button>
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst || disabled} className="block w-full rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-30">← 앞으로</button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast || disabled} className="block w-full rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-30">→ 뒤로</button>
          <button type="button" onClick={onDelete} disabled={disabled} className="block w-full rounded px-2 py-1 text-left text-red-600 hover:bg-red-50 disabled:opacity-50">🗑 삭제</button>
        </div>
      </details>
    </div>
  );
}

"use client";

import { useEffect, useId, useState, useTransition } from "react";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ComposedPage } from "@/components/public/composed-page";
import { PageEditor } from "@/components/admin/page-editor";
import { parsePageLayout } from "@/types/magazine-layout";
import {
  createComposedPage,
  deletePage,
  reorderPages,
} from "@/actions/page-actions";

type PageItem = {
  id: string;
  pageNumber: number;
  layout: unknown;
  articleId: string | null;
};
type ArticleOpt = {
  id: string;
  title: string;
  genre?: string | null;
  subCategory?: string | null;
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
  const [view, setView] = useState<"rail" | "grid">("rail"); // 페이지 패널 표시 방식
  const [pending, start] = useTransition();
  const dndId = useId();

  // 서버 refresh로 pages가 갱신되면 items 동기화(낙관적 업데이트 후 정합).
  // 선택은 렌더에서 파생(유효치 않으면 첫 페이지 폴백)하므로 여기선 items만.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const r = await createComposedPage(magazineId);
      if (r?.pageId) {
        setSelectedId(r.pageId); // 라우트 이동 없이 새 페이지 선택
        router.refresh();
        toast.success("새 페이지를 추가했습니다");
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

  return (
    <div className="grid gap-4 lg:grid-cols-[208px_1fr]">
      {/* 좌: 페이지 패널 (rail/grid 토글) */}
      <aside className="space-y-3 rounded-lg border bg-card p-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            페이지 · {items.length}
          </span>
          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => setView("rail")}
              aria-label="목록 보기"
              title="목록 보기"
              className={`rounded px-1.5 text-xs ${view === "rail" ? "bg-accent" : "text-muted-foreground"}`}
            >
              ▤
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="격자 보기"
              title="격자 보기"
              className={`rounded px-1.5 text-xs ${view === "grid" ? "bg-accent" : "text-muted-foreground"}`}
            >
              ▦
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={addPage}
          disabled={pending}
          className="w-full rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
        >
          ＋ 새 페이지
        </button>
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            “새 페이지”로 추가하세요.
          </p>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div
                className={`max-h-[70vh] overflow-y-auto pr-1 ${
                  view === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"
                }`}
              >
                {items.map((p, i) => (
                  <PageRailItem
                    key={p.id}
                    page={p}
                    grid={view === "grid"}
                    selected={p.id === selectedId}
                    onSelect={() => setSelectedId(p.id)}
                    onMove={(dir) => move(i, dir)}
                    onDelete={() => del(p.id)}
                    isFirst={i === 0}
                    isLast={i === items.length - 1}
                    disabled={pending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </aside>

      {/* 우: 활성 페이지 편집기 (라우트 전환 없이 key로 스위칭) */}
      <div className="min-w-0">
        {selected ? (
          <PageEditor
            key={selected.id}
            embedded
            magazineId={magazineId}
            pageId={selected.id}
            pageNumber={selectedIndex + 1}
            totalPages={items.length}
            initialLayout={parsePageLayout(selected.layout) ?? { blocks: [] }}
            initialArticleId={selected.articleId}
            articles={articles}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            왼쪽에서 페이지를 선택하거나 새로 추가하세요.
          </div>
        )}
      </div>
    </div>
  );
}

function PageRailItem({
  page,
  grid,
  selected,
  onSelect,
  onMove,
  onDelete,
  isFirst,
  isLast,
  disabled,
}: {
  page: PageItem;
  grid: boolean;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
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
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border p-1.5 ${
        selected ? "border-primary ring-2 ring-primary/20" : "bg-card"
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="드래그하여 순서 변경"
          className="cursor-grab touch-none px-1 text-gray-400 active:cursor-grabbing"
        >
          ⠿
        </button>
        <span className="text-muted-foreground">P.{page.pageNumber}</span>
        {/* 컨텍스트 메뉴(···): 위로/아래로/삭제 */}
        <details className="relative">
          <summary className="cursor-pointer list-none px-1 text-muted-foreground hover:text-foreground">
            ⋯
          </summary>
          <div className="absolute right-0 z-30 mt-1 w-24 rounded-md border bg-popover p-1 text-[11px] shadow-md">
            <button type="button" onClick={() => onMove(-1)} disabled={isFirst || disabled} className="block w-full rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-30">↑ 위로</button>
            <button type="button" onClick={() => onMove(1)} disabled={isLast || disabled} className="block w-full rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-30">↓ 아래로</button>
            <button type="button" onClick={onDelete} disabled={disabled} className="block w-full rounded px-2 py-1 text-left text-red-600 hover:bg-red-50 disabled:opacity-50">🗑 삭제</button>
          </div>
        </details>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="block w-full"
        aria-label={`페이지 ${page.pageNumber} 편집`}
      >
        <div className={`relative w-full overflow-hidden rounded bg-neutral-900 ${grid ? "aspect-[2/3]" : "aspect-[2/3]"}`}>
          <ComposedPage layout={parsePageLayout(page.layout)} />
        </div>
      </button>
    </div>
  );
}

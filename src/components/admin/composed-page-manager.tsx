"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ComposedPage } from "@/components/public/composed-page";
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

function SortableCard({
  page,
  index,
  magazineId,
  onMove,
  onDelete,
  isFirst,
  isLast,
  disabled,
}: {
  page: PageItem;
  index: number;
  magazineId: string;
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
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card p-2">
      <div className="mb-1 flex items-center justify-between text-xs">
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
      </div>
      <Link
        href={`/admin/magazines/${magazineId}/pages/${page.id}`}
        className="block"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-neutral-900">
          <ComposedPage layout={parsePageLayout(page.layout)} />
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-end gap-1 text-xs">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst || disabled}
          className="rounded border px-1.5 py-0.5 disabled:opacity-30"
          aria-label="앞으로"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast || disabled}
          className="rounded border px-1.5 py-0.5 disabled:opacity-30"
          aria-label="뒤로"
        >
          ↓
        </button>
        <Link
          href={`/admin/magazines/${magazineId}/pages/${page.id}`}
          className="rounded border px-2 py-0.5 hover:bg-accent"
        >
          편집
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="rounded border px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

export function ComposedPageManager({
  magazineId,
  pages,
}: {
  magazineId: string;
  pages: PageItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<PageItem[]>(pages);
  const [pending, start] = useTransition();
  const dndId = useId();

  useEffect(() => {
    setItems(pages);
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function persist(reordered: PageItem[]) {
    setItems(reordered);
    start(async () => {
      await reorderPages(
        magazineId,
        reordered.map((p) => p.id)
      );
      toast.success("페이지 순서가 변경되었습니다");
      router.refresh();
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persist(arrayMove(items, oldIndex, newIndex));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    persist(arrayMove(items, index, target));
  }

  function addPage() {
    start(async () => {
      const r = await createComposedPage(magazineId);
      if (r?.pageId) {
        router.push(`/admin/magazines/${magazineId}/pages/${r.pageId}`);
      }
    });
  }

  function del(id: string) {
    if (!confirm("이 페이지를 삭제하시겠습니까?")) return;
    start(async () => {
      await deletePage(id, magazineId);
      setItems((prev) => prev.filter((p) => p.id !== id));
      toast.success("삭제되었습니다");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          ⠿ 드래그(또는 ↑↓)로 순서 변경 · “편집”으로 자유배치 구성.
        </p>
        <button
          type="button"
          onClick={addPage}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          + 새 페이지
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          아직 페이지가 없습니다. “새 페이지”로 추가하세요.
        </p>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {items.map((p, i) => (
                <SortableCard
                  key={p.id}
                  page={p}
                  index={i}
                  magazineId={magazineId}
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
    </div>
  );
}

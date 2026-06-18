"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
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
import { toast } from "sonner";
import { reorderArticles } from "@/actions/article-actions";
import { StatusBadge } from "./status-badge";
import type { MagazineArticle } from "@/types/magazine";

function SortableRow({
  article,
  index,
  magazineId,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  article: MagazineArticle;
  index: number;
  magazineId: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border-b bg-white py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="드래그하여 순서 변경"
        className="cursor-grab touch-none px-1 text-gray-400 active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <Link
        href={`/admin/magazines/${magazineId}/articles/${article.id}/edit`}
        className="min-w-0 flex-1 rounded px-1 py-1 transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          {article.section && (
            <span className="shrink-0 text-xs font-medium text-[#6f5c24]">
              {article.section}
            </span>
          )}
          {article.isCoverStory && (
            <span className="shrink-0 rounded bg-[#6f5c24]/10 px-1.5 py-0.5 text-[10px] text-[#6f5c24]">
              커버스토리
            </span>
          )}
        </div>
        <div className="truncate font-medium">{article.title}</div>
      </Link>
      <StatusBadge status={article.status} />
      {/* Mobile reorder fallback */}
      <div className="flex shrink-0 gap-0.5 md:hidden">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="위로"
          className="px-1.5 text-gray-500 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="아래로"
          className="px-1.5 text-gray-500 disabled:opacity-30"
        >
          ↓
        </button>
      </div>
    </li>
  );
}

export function ArticleListSortable({
  articles: serverArticles,
  magazineId,
}: {
  articles: MagazineArticle[];
  magazineId: string;
}) {
  const [articles, setArticles] = useState(serverArticles);
  const dndId = useId();

  // Re-sync when server data changes (e.g. after add/delete + refresh).
  useEffect(() => {
    setArticles(serverArticles);
  }, [serverArticles]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function persist(reordered: MagazineArticle[]) {
    setArticles(reordered);
    const result = await reorderArticles(
      magazineId,
      reordered.map((a) => a.id)
    );
    if (result?.success) toast.success("아티클 순서가 변경되었습니다");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = articles.findIndex((a) => a.id === active.id);
    const newIndex = articles.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persist(arrayMove(articles, oldIndex, newIndex));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= articles.length) return;
    persist(arrayMove(articles, index, target));
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={articles} strategy={verticalListSortingStrategy}>
        <ul>
          {articles.map((a, i) => (
            <SortableRow
              key={a.id}
              article={a}
              index={i}
              magazineId={magazineId}
              onMoveUp={() => move(i, -1)}
              onMoveDown={() => move(i, 1)}
              isFirst={i === 0}
              isLast={i === articles.length - 1}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

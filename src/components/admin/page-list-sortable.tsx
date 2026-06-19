"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
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
// Using native img to avoid Vercel Image Optimization limits
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reorderPages, deletePage, renamePageFiles, renamePageFile } from "@/actions/page-actions";
import { toast } from "sonner";
import type { MagazinePage } from "@/types/magazine";

function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").pop() || "";
    return decodeURIComponent(filename);
  } catch {
    return "";
  }
}

function getFilenameWithoutExt(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useFileSizes(pages: MagazinePage[]) {
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const pagesKey = pages.map((p) => p.id).join(",");

  useEffect(() => {
    let cancelled = false;
    async function fetchSizes() {
      const results: Record<string, number> = {};
      await Promise.all(
        pages.map(async (page) => {
          if (!page.imageUrl) return;
          try {
            const res = await fetch(page.imageUrl, { method: "HEAD" });
            const len = res.headers.get("content-length");
            if (len) results[page.id] = parseInt(len, 10);
          } catch { /* ignore */ }
        })
      );
      if (!cancelled) setSizes(results);
    }
    fetchSizes();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  return sizes;
}

function SortablePageItem({
  page,
  magazineId,
  onDelete,
  fileSize,
}: {
  page: MagazinePage;
  magazineId: string;
  onDelete: (id: string) => void;
  fileSize?: number;
}) {
  const filename = getFilenameFromUrl(page.imageUrl ?? "");
  const baseName = getFilenameWithoutExt(filename);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(baseName);
  const [saving, setSaving] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleRename() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === baseName) {
      setEditing(false);
      setEditValue(baseName);
      return;
    }
    setSaving(true);
    const result = await renamePageFile(page.id, magazineId, trimmed);
    if ("error" in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success("파일명이 변경되었습니다");
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border bg-white p-2"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded">
          <img
            src={page.imageUrl ?? ""}
            alt={`Page ${page.pageNumber}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className="text-xs text-gray-500">
          {page.pageNumber}
          {fileSize != null && (
            <span className="ml-1 text-gray-400">({formatFileSize(fileSize)})</span>
          )}
        </p>
        {editing ? (
          <div className="mt-0.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setEditing(false); setEditValue(baseName); }
              }}
              className="h-6 text-[10px] px-1"
              autoFocus
              disabled={saving}
            />
          </div>
        ) : (
          <p
            className="mt-0.5 cursor-pointer truncate text-[10px] text-gray-400 hover:text-blue-500"
            title={`클릭하여 파일명 변경: ${filename}`}
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          >
            {filename}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(page.id)}
        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
        type="button"
      >
        &times;
      </button>
    </div>
  );
}

export function PageListSortable({
  pages: serverPages,
  magazineId,
}: {
  pages: MagazinePage[];
  magazineId: string;
}) {
  const [pages, setPages] = useState(serverPages);
  const [renaming, setRenaming] = useState(false);
  const router = useRouter();
  const dndId = useId();
  const fileSizes = useFileSizes(pages);

  // Sync with server props when they change (e.g. after upload + router.refresh)
  useEffect(() => {
    setPages(serverPages);
  }, [serverPages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    const newPages = arrayMove(pages, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sortOrder: i,
      pageNumber: i + 1,
    }));

    setPages(newPages);

    const result = await reorderPages(
      magazineId,
      newPages.map((p) => p.id)
    );

    if (result.success) {
      toast.success("페이지 순서가 변경되었습니다");
    }
  }

  async function handleDelete(pageId: string) {
    const result = await deletePage(pageId, magazineId);
    if (result.success) {
      setPages((prev) =>
        prev
          .filter((p) => p.id !== pageId)
          .map((p, i) => ({ ...p, sortOrder: i, pageNumber: i + 1 }))
      );
      toast.success("페이지가 삭제되었습니다");
    }
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const newPages = arrayMove(pages, index, index - 1).map((p, i) => ({
      ...p,
      sortOrder: i,
      pageNumber: i + 1,
    }));
    setPages(newPages);
    reorderPages(magazineId, newPages.map((p) => p.id));
  }

  function handleMoveDown(index: number) {
    if (index === pages.length - 1) return;
    const newPages = arrayMove(pages, index, index + 1).map((p, i) => ({
      ...p,
      sortOrder: i,
      pageNumber: i + 1,
    }));
    setPages(newPages);
    reorderPages(magazineId, newPages.map((p) => p.id));
  }

  const [renameProgress, setRenameProgress] = useState({ current: 0, total: 0 });

  async function handleRenameFiles() {
    const total = pages.length * 2; // 2-pass: tmp → final
    setRenaming(true);
    setRenameProgress({ current: 0, total });

    let failed = 0;

    // Pass 1: rename all to temporary names to avoid conflicts
    for (let i = 0; i < pages.length; i++) {
      setRenameProgress({ current: i + 1, total });
      try {
        const result = await renamePageFile(pages[i].id, magazineId, `_tmp_${i + 1}`);
        if ("error" in result && result.error) failed++;
      } catch { failed++; }
    }

    // Pass 2: rename from temporary to final page numbers
    for (let i = 0; i < pages.length; i++) {
      setRenameProgress({ current: pages.length + i + 1, total });
      try {
        const result = await renamePageFile(pages[i].id, magazineId, String(i + 1));
        if ("error" in result && result.error) failed++;
      } catch { failed++; }
    }

    if (failed === 0) {
      toast.success(`${pages.length}개 파일명이 변경되었습니다`);
    } else {
      toast.error(`${failed}개 파일 변경 실패`);
    }
    router.refresh();

    setRenaming(false);
    setRenameProgress({ current: 0, total: 0 });
  }

  if (pages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        아직 페이지가 없습니다. 위에서 이미지를 업로드해주세요.
      </p>
    );
  }

  return (
    <>
      {/* Desktop: drag & drop grid */}
      <div className="hidden md:block">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 gap-4 lg:grid-cols-6">
              {pages.map((page) => (
                <SortablePageItem
                  key={page.id}
                  page={page}
                  magazineId={magazineId}
                  onDelete={handleDelete}
                  fileSize={fileSizes[page.id]}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Mobile: list with move buttons */}
      <div className="space-y-2 md:hidden">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="flex items-center gap-3 rounded-lg border bg-white p-2"
          >
            <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded">
              <img
                src={page.imageUrl ?? ""}
                alt={`Page ${page.pageNumber}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm text-gray-600">P.{page.pageNumber}</span>
              {fileSizes[page.id] != null && (
                <span className="ml-1 text-xs text-gray-400">({formatFileSize(fileSizes[page.id])})</span>
              )}
              <p className="truncate text-[10px] text-gray-400">
                {getFilenameFromUrl(page.imageUrl ?? "")}
              </p>
            </div>
            <div className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
              >
                &uarr;
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMoveDown(index)}
                disabled={index === pages.length - 1}
              >
                &darr;
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500"
                onClick={() => handleDelete(page.id)}
              >
                &times;
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Rename files button */}
      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRenameFiles}
          disabled={renaming}
        >
          {renaming
            ? `변경 중... (${renameProgress.current}/${renameProgress.total})`
            : "파일명 정리 (1, 2, 3...)"}
        </Button>
      </div>
    </>
  );
}

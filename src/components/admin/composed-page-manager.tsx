"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    start(async () => {
      await reorderPages(
        magazineId,
        next.map((p) => p.id)
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          페이지를 추가하고 자유배치 에디터에서 글·이미지를 구성하세요.
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((p, i) => (
            <div key={p.id} className="rounded-lg border bg-card p-2">
              <Link
                href={`/admin/magazines/${magazineId}/pages/${p.id}`}
                className="block"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded bg-neutral-900">
                  <ComposedPage layout={parsePageLayout(p.layout)} />
                </div>
              </Link>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">P.{p.pageNumber}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || pending}
                    className="rounded border px-1.5 py-0.5 disabled:opacity-30"
                    aria-label="앞으로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1 || pending}
                    className="rounded border px-1.5 py-0.5 disabled:opacity-30"
                    aria-label="뒤로"
                  >
                    ↓
                  </button>
                  <Link
                    href={`/admin/magazines/${magazineId}/pages/${p.id}`}
                    className="rounded border px-2 py-0.5 hover:bg-accent"
                  >
                    편집
                  </Link>
                  <button
                    type="button"
                    onClick={() => del(p.id)}
                    disabled={pending}
                    className="rounded border px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

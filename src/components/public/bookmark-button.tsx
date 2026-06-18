"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleBookmark } from "@/actions/bookmark-actions";

export function BookmarkButton({
  articleId,
  initialBookmarked,
}: {
  articleId: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await toggleBookmark(articleId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setBookmarked(res.bookmarked);
      toast.success(res.bookmarked ? "북마크에 추가했습니다" : "북마크를 해제했습니다");
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={bookmarked}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-label text-[11px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${
        bookmarked
          ? "border-[#1c1b1b] bg-[#1c1b1b] text-white"
          : "border-[#1c1b1b]/20 text-[#1c1b1b] hover:border-[#6f5c24] hover:text-[#6f5c24]"
      }`}
    >
      {bookmarked ? "★ 북마크됨" : "☆ 북마크"}
    </button>
  );
}

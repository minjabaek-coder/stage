"use client";

export function ScrollToTopButton() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="group flex items-center gap-1.5 text-xs text-white/55 transition-colors hover:text-white"
      aria-label="맨 위로 스크롤"
    >
      <span className="hidden sm:inline">맨 위로</span>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 transition-colors group-hover:border-white/40 group-hover:bg-white/5">
        &#8593;
      </span>
    </button>
  );
}

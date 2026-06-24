"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ARTICLE_GENRES } from "@/lib/article-taxonomy";

// v2 장르 서브내비 (global-chrome §4). 기사 대분류(장르) 필터로 연동.
// 탭: 전체 + 8장르(공유 상수). 클릭 시 ?genre= 로 목록 필터.
const GENRES = ["전체", ...ARTICLE_GENRES];

export function GenreSubNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("genre") ?? "전체";

  return (
    <div className="sticky top-[58px] z-[99] border-b border-ink/10 bg-surface-warm/90 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-[1380px] overflow-x-auto px-3 sm:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GENRES.map((g) => {
          const href =
            g === "전체"
              ? pathname
              : `${pathname}?genre=${encodeURIComponent(g)}`;
          const isActive = active === g;
          return (
            <Link
              key={g}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-[38px] flex-shrink-0 items-center whitespace-nowrap border-b-2 px-3.5 font-body text-[11px] font-semibold transition-colors ${
                isActive
                  ? "border-gold text-ink"
                  : "border-transparent text-ink/45 hover:text-ink"
              }`}
            >
              {g}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

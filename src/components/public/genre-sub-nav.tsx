"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// v2 장르 서브내비 (global-chrome §4). 기사 장르 필터로 활용.
// 탭: 전체 + 8장르(그대로). NEW/AI추천은 후속(데이터·AI 큐레이션 필요).
// 실제 필터 연동(?genre= → 목록)은 Phase 3 기사 페이지에서.
const GENRES = [
  "전체",
  "클래식",
  "오페라",
  "무용",
  "연극",
  "뮤지컬",
  "국악",
  "전시",
  "교육",
];

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

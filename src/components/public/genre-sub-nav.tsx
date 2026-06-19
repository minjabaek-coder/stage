"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// 월간객석 벤치마킹 — 장르 탭. 실제 필터링 연동은 B3에서.
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
    <div className="sticky top-14 z-[9] border-b border-gray-100 bg-[#f8f5f0]/90 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-6 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`whitespace-nowrap border-b-2 px-1 pb-1 font-label text-sm transition-colors ${
                isActive
                  ? "border-[#c4a35a] font-semibold text-[#1c1b1b]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
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

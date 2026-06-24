"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { ARTICLE_SUBCATEGORIES } from "@/lib/article-taxonomy";

// 소분류(형식) 필터 — "N개의 기사" 라인 우측에서 클릭하면 펼쳐지는 칩 목록.
// 현재 대분류(?genre=)는 유지하고 ?sub= 만 토글(AND 결합).
export function ArticleSubFilter() {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeSub = params.get("sub");
  const [open, setOpen] = useState(!!activeSub);

  function hrefFor(sub: string | null) {
    const next = new URLSearchParams(params.toString());
    if (sub) next.set("sub", sub);
    else next.delete("sub");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 font-label text-[11px] uppercase tracking-wider text-ink/60 transition-colors hover:text-gold-deep"
      >
        {activeSub ?? "소분류"}
        <ChevronDownIcon
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Link
            href={hrefFor(null)}
            className={`border px-2.5 py-1 font-label text-[11px] tracking-wide transition-colors ${
              !activeSub
                ? "border-gold-deep bg-gold-deep text-white"
                : "border-ink/15 text-ink/60 hover:border-gold-deep hover:text-gold-deep"
            }`}
          >
            전체
          </Link>
          {ARTICLE_SUBCATEGORIES.map((s) => {
            const isActive = activeSub === s;
            return (
              <Link
                key={s}
                href={hrefFor(isActive ? null : s)}
                aria-current={isActive ? "true" : undefined}
                className={`border px-2.5 py-1 font-label text-[11px] tracking-wide transition-colors ${
                  isActive
                    ? "border-gold-deep bg-gold-deep text-white"
                    : "border-ink/15 text-ink/60 hover:border-gold-deep hover:text-gold-deep"
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

interface Magazine {
  id: string;
  issueNumber: number;
  title: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  contentType: string;
}

const DEFAULT_SHOW = 5; // 데스크탑 한 줄(5개) 기본, 전체보기로 확장

// v2 매거진 아카이브 그리드 (page-home §G): 각진 표지 카드, 작게·촘촘하게.
export function PastMagazines({ magazines }: { magazines: Magazine[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? magazines : magazines.slice(0, DEFAULT_SHOW);
  const hasMore = magazines.length > DEFAULT_SHOW;

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2.5">
        <h2 className="font-label text-[13px] font-bold uppercase tracking-[0.2em] text-ink">
          매거진 아카이브
        </h2>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-label text-[11px] text-gold-deep transition-colors hover:underline"
          >
            {expanded ? "접기" : "전체보기"} →
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((mag) => (
          <Link key={mag.id} href={`/magazines/${mag.id}`} className="group">
            <div className="relative mb-2 aspect-[3/4] overflow-hidden bg-ink-deep">
              {mag.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mag.coverImageUrl}
                  alt={mag.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-headline text-sm font-black text-white/30">
                    STAGE
                  </span>
                </div>
              )}
              {mag.contentType !== "image" && (
                <span className="absolute right-1 top-1 rounded-sm bg-teal/90 px-1 py-0.5 font-label text-[7px] font-bold tracking-wide text-white">
                  WEB
                </span>
              )}
            </div>
            <h5 className="line-clamp-1 text-[11px] font-medium text-ink transition-colors group-hover:text-gold-deep">
              {mag.title}
            </h5>
            <div className="mt-0.5 font-label text-[8px] tracking-wide text-date">
              Vol.{String(mag.issueNumber).padStart(2, "0")}
              {mag.publishedAt &&
                ` · ${new Date(mag.publishedAt).getFullYear()}.${String(
                  new Date(mag.publishedAt).getMonth() + 1,
                ).padStart(2, "0")}`}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

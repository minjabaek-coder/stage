"use client";

import { useState } from "react";
import Link from "next/link";

export type ArchiveItem = {
  id: string;
  issueNumber: number;
  month: number;
};
export type ArchiveGroup = { year: number; items: ArchiveItem[] };

// 좌측 레일 아카이브 (page-home §A-2): 연도 접기 매거진 인덱스.
export function ArchiveNav({ groups }: { groups: ArchiveGroup[] }) {
  const [openYear, setOpenYear] = useState<number | null>(
    groups[0]?.year ?? null,
  );

  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border border-ink/[0.06] bg-paper p-3.5">
      <div className="mb-2 font-label text-[8px] uppercase tracking-[3px] text-ink/30">
        아카이브
      </div>
      {groups.map((g) => {
        const isOpen = openYear === g.year;
        return (
          <div key={g.year}>
            <button
              type="button"
              onClick={() => setOpenYear(isOpen ? null : g.year)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[12px] font-bold text-slate transition-colors hover:bg-black/[0.03]"
            >
              <span>{g.year > 0 ? `${g.year}년` : "기타"}</span>
              <span className="text-[9px] text-ink/40">{isOpen ? "▼" : "▶"}</span>
            </button>
            {isOpen && (
              <div className="mb-1 pl-1.5">
                {g.items.map((m) => (
                  <Link
                    key={m.id}
                    href={`/magazines/${m.id}`}
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-ink/45 transition-colors hover:bg-gold/[0.06] hover:text-gold-deep"
                  >
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-gold" />
                    {m.month > 0 ? `${m.month}월 ` : ""}Vol.
                    {String(m.issueNumber).padStart(2, "0")}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

type SortOrder = "desc" | "asc";

interface Magazine {
  id: string;
  issueNumber: number;
  title: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  contentType: string;
}

interface MagazineGridProps {
  magazines: Magazine[];
}

const sortLabels: Record<SortOrder, string> = {
  desc: "최신호순",
  asc: "1호부터",
};

export function MagazineGrid({ magazines }: MagazineGridProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [query, setQuery] = useState("");

  const latestIssue = magazines.length
    ? Math.max(...magazines.map((m) => m.issueNumber))
    : 0;

  const sorted = useMemo(() => {
    return [...magazines].sort((a, b) =>
      sortOrder === "desc"
        ? b.issueNumber - a.issueNumber
        : a.issueNumber - b.issueNumber
    );
  }, [magazines, sortOrder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        String(m.issueNumber).includes(q)
    );
  }, [sorted, query]);

  return (
    <>
      <div className="mt-8 flex items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="호수 또는 제목 검색"
          aria-label="매거진 검색"
          className="w-full max-w-xs border-b border-ink/20 bg-transparent px-1 py-1.5 text-sm text-ink placeholder:text-ink/40 focus:border-gold-deep focus:outline-none"
        />
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 border-b border-ink/20 px-1 py-1.5 font-label text-xs uppercase tracking-wider text-ink transition-colors hover:text-gold-deep">
            {sortLabels[sortOrder]}
            <ChevronDownIcon className="size-4 text-ink/40" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sortOrder}
              onValueChange={(value) => setSortOrder(value as SortOrder)}
            >
              <DropdownMenuRadioItem value="desc">
                최신호순
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="asc">
                1호부터
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {magazines.length === 0 ? (
        <div className="mt-24 text-center text-taupe">
          아직 발행된 매거진이 없습니다.
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-24 text-center text-taupe">검색 결과가 없습니다.</div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((magazine) => (
            <Link
              key={magazine.id}
              href={`/magazines/${magazine.id}`}
              className="group"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-ink-deep">
                {magazine.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={magazine.coverImageUrl}
                    alt={magazine.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-headline text-lg font-black text-white/30">
                      STAGE
                    </span>
                  </div>
                )}
                <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
                  {magazine.issueNumber === latestIssue && (
                    <span className="bg-gold px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-wider text-ink">
                      NEW
                    </span>
                  )}
                  {magazine.contentType !== "image" && (
                    <span className="rounded-sm bg-teal/90 px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-wider text-white">
                      인터랙티브
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <p className="line-clamp-1 text-sm font-semibold text-ink transition-colors group-hover:text-gold-deep">
                  {magazine.title}
                </p>
                {magazine.publishedAt && (
                  <p className="mt-1 font-label text-[10px] tracking-wide text-date">
                    {new Date(magazine.publishedAt).getFullYear()}.
                    {String(
                      new Date(magazine.publishedAt).getMonth() + 1,
                    ).padStart(2, "0")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

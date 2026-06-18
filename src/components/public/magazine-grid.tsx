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

  return (
    <>
      <div className="mt-8 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            {sortLabels[sortOrder]}
            <ChevronDownIcon className="size-4 text-gray-400" />
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

      {sorted.length === 0 ? (
        <div className="mt-24 text-center text-gray-400">
          No published magazines yet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sorted.map((magazine) => (
            <Link
              key={magazine.id}
              href={`/magazines/${magazine.id}`}
              className="group"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100">
                {magazine.coverImageUrl ? (
                  <img
                    src={magazine.coverImageUrl}
                    alt={magazine.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    No Cover
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
                <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
                  {magazine.issueNumber === latestIssue && (
                    <span className="rounded bg-[#6f5c24] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                      NEW
                    </span>
                  )}
                  {magazine.contentType === "web" && (
                    <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6f5c24] shadow">
                      인터랙티브
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm font-semibold line-clamp-1">
                  {magazine.title}
                </p>
                {magazine.publishedAt && (
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(magazine.publishedAt).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
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

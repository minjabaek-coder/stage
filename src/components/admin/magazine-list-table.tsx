"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./status-badge";
import { MagazineCover } from "@/components/public/magazine-cover";
import type { MagazineListItem } from "@/types/magazine";

type MagazineRow = MagazineListItem & { coverLayout?: unknown };

export function MagazineListTable({
  magazines,
}: {
  magazines: MagazineRow[];
}) {
  const router = useRouter();

  if (magazines.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">
        아직 매거진이 없습니다.
      </p>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">커버</TableHead>
              <TableHead className="w-20">호수</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="w-24">상태</TableHead>
              <TableHead className="w-20">페이지</TableHead>
              <TableHead className="w-28">발행일</TableHead>
              <TableHead className="w-20">조회수</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {magazines.map((mag) => (
              <TableRow key={mag.id}>
                <TableCell>
                  <div className="group relative h-12 w-9 overflow-hidden rounded bg-ink-deep">
                    <MagazineCover
                      coverImageUrl={mag.coverImageUrl}
                      contentType={mag.contentType}
                      coverLayout={mag.coverLayout}
                      title={mag.title}
                      placeholderClass="text-[8px]"
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  #{mag.issueNumber}
                </TableCell>
                <TableCell>{mag.title}</TableCell>
                <TableCell>
                  <StatusBadge status={mag.status} />
                </TableCell>
                <TableCell>{mag._count.pages}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {mag.publishedAt
                    ? new Date(mag.publishedAt).toLocaleDateString("ko-KR")
                    : "-"}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {mag.viewCount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted">
                      ...
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/admin/magazines/${mag.id}/edit`)
                        }
                      >
                        수정
                      </DropdownMenuItem>
                      {mag.status === "published" && (
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/magazines/${mag.id}`)
                          }
                        >
                          보기
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {magazines.map((mag) => (
          <Link
            key={mag.id}
            href={`/admin/magazines/${mag.id}/edit`}
            className="flex items-center gap-3 rounded-lg border bg-white p-3"
          >
            <div className="group relative h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-ink-deep">
              <MagazineCover
                coverImageUrl={mag.coverImageUrl}
                contentType={mag.contentType}
                coverLayout={mag.coverLayout}
                title={mag.title}
                placeholderClass="text-[9px]"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                #{mag.issueNumber} {mag.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={mag.status} />
                <span className="text-xs text-gray-400">
                  {mag._count.pages}p
                </span>
                <span className="text-xs text-gray-400">
                  {mag.viewCount.toLocaleString()}회
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

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
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import type { Article } from "@/types/article";

export function ArticleListTable({ articles }: { articles: Article[] }) {
  const router = useRouter();

  if (articles.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">아직 기사가 없습니다.</p>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">썸네일</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="w-24">카테고리</TableHead>
              <TableHead className="w-28">상태</TableHead>
              <TableHead className="w-28">작성일</TableHead>
              <TableHead className="w-20">조회수</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell>
                  {article.thumbnailUrl ? (
                    <div className="relative h-10 w-14 overflow-hidden rounded">
                      <img
                        src={article.thumbnailUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        sizes="56px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded bg-gradient-to-br from-gray-800 to-gray-950">
                      <span className="text-[8px] font-bold tracking-wider text-white/80">
                        STAGE
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {article.title}
                    {article.isFeatured && (
                      <Badge variant="outline" className="border-[#6f5c24] text-[#6f5c24]">
                        추천
                      </Badge>
                    )}
                    {article.isPremium && (
                      <Badge className="bg-[#6f5c24] text-white">프리미엄</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {article.category || "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={article.status} />
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("ko-KR")
                    : "-"}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {article.viewCount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium hover:bg-muted">
                      ...
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/admin/articles/${article.id}/edit`)
                        }
                      >
                        수정
                      </DropdownMenuItem>
                      {article.status === "published" && (
                        <DropdownMenuItem
                          onClick={() => router.push(`/articles/${article.slug}`)}
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
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/admin/articles/${article.id}/edit`}
            className="flex items-center gap-3 rounded-lg border bg-white p-3"
          >
            {article.thumbnailUrl ? (
              <div className="relative h-16 w-20 flex-shrink-0 overflow-hidden rounded">
                <img
                  src={article.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-16 w-20 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-gray-800 to-gray-950">
                <span className="text-[10px] font-bold tracking-wider text-white/80">
                  STAGE
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{article.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={article.status} />
                {article.isPremium && (
                  <Badge className="bg-[#6f5c24] text-white">프리미엄</Badge>
                )}
                <span className="text-xs text-gray-400">
                  {article.viewCount.toLocaleString()}회
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

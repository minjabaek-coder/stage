export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminDashboardPage() {
  const [
    magazineStats,
    articleStats,
    topMagazines,
    topArticles,
    magazineCount,
    articleCount,
  ] = await Promise.all([
    prisma.magazine.aggregate({ _sum: { viewCount: true } }),
    prisma.article.aggregate({ _sum: { viewCount: true } }),
    prisma.magazine.findMany({
      where: { status: "published" },
      orderBy: { viewCount: "desc" },
      take: 5,
    }),
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { viewCount: "desc" },
      take: 5,
    }),
    prisma.magazine.count({ where: { status: "published" } }),
    prisma.article.count({ where: { status: "published" } }),
  ]);

  const totalMagazineViews = magazineStats._sum.viewCount ?? 0;
  const totalArticleViews = articleStats._sum.viewCount ?? 0;
  const totalViews = totalMagazineViews + totalArticleViews;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              총 조회수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              매거진
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalMagazineViews.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">
              {magazineCount}개 발행
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              기사
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalArticleViews.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">
              {articleCount}개 발행
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>인기 매거진 Top 5</CardTitle>
              <Link
                href="/admin/magazines"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                전체보기
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topMagazines.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                데이터 없음
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="w-24 text-right">조회수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMagazines.map((mag, i) => (
                    <TableRow key={mag.id}>
                      <TableCell className="text-gray-400">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        #{mag.issueNumber} {mag.title}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {mag.viewCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>인기 기사 Top 5</CardTitle>
              <Link
                href="/admin/articles"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                전체보기
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topArticles.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                데이터 없음
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="w-24 text-right">조회수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topArticles.map((article, i) => (
                    <TableRow key={article.id}>
                      <TableCell className="text-gray-400">{i + 1}</TableCell>
                      <TableCell className="font-medium truncate max-w-[200px]">
                        {article.title}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {article.viewCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

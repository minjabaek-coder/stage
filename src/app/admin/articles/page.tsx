export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArticleListTable } from "@/components/admin/article-list-table";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "submitted", label: "검토대기" },
  { key: "draft", label: "초안" },
  { key: "published", label: "발행됨" },
] as const;

const VALID = new Set(["submitted", "draft", "published"]);

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status && VALID.has(status) ? status : "all";

  const [articles, grouped] = await Promise.all([
    prisma.article.findMany({
      where:
        active !== "all"
          ? { status: active as "submitted" | "draft" | "published" }
          : {},
      orderBy: { updatedAt: "desc" },
    }),
    prisma.article.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (k: string) =>
    k === "all"
      ? grouped.reduce((a, g) => a + g._count, 0)
      : (grouped.find((g) => g.status === k)?._count ?? 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">기사 관리</h1>
        <Link href="/admin/articles/new">
          <Button>새 기사 작성</Button>
        </Link>
      </div>

      {/* 상태 필터 (검토대기 강조) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = active === f.key;
          const count = countOf(f.key);
          const emphasize = f.key === "submitted" && count > 0;
          return (
            <Link
              key={f.key}
              href={
                f.key === "all"
                  ? "/admin/articles"
                  : `/admin/articles?status=${f.key}`
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                isActive
                  ? "border-gray-900 bg-gray-900 text-white"
                  : emphasize
                    ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {f.label}
              <span
                className={`text-xs ${isActive ? "opacity-70" : "opacity-50"}`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <ArticleListTable articles={articles} />
    </div>
  );
}

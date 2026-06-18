export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArticleListTable } from "@/components/admin/article-list-table";

export default async function AdminArticlesPage() {
  const articles = await prisma.article.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">기사 관리</h1>
        <Link href="/admin/articles/new">
          <Button>새 기사 작성</Button>
        </Link>
      </div>
      <ArticleListTable articles={articles} />
    </div>
  );
}

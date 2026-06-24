export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageEditor } from "@/components/admin/page-editor";
import { parsePageLayout } from "@/types/magazine-layout";

export default async function ComposedPageEditorRoute({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id, pageId } = await params;
  const [page, articles] = await Promise.all([
    prisma.magazinePage.findUnique({ where: { id: pageId } }),
    // 페이지가 "싣는 기사"로 연동할 후보 — 단일 Article 모델(전체). 최신순.
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, genre: true, subCategory: true },
    }),
  ]);
  if (!page || page.magazineId !== id) notFound();

  const layout = parsePageLayout(page.layout) ?? { blocks: [] };

  return (
    <PageEditor
      magazineId={id}
      pageId={page.id}
      pageNumber={page.pageNumber}
      initialLayout={layout}
      initialArticleId={page.articleId}
      articles={articles}
    />
  );
}

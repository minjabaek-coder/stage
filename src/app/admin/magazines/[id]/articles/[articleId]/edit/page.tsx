export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/admin/magazine-article-form";
import { ArticleStatusActions } from "@/components/admin/magazine-article-status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { updateArticle } from "@/actions/magazine-article-actions";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string; articleId: string }>;
}) {
  const { id, articleId } = await params;

  const article = await prisma.magazineArticle.findUnique({
    where: { id: articleId },
  });
  if (!article || article.magazineId !== id) notFound();

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateArticle(articleId, id, _state, formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/magazines/${id}/edit`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 매거진
          </Link>
          <h1 className="text-2xl font-bold">아티클 수정</h1>
          <StatusBadge status={article.status} />
        </div>
        <ArticleStatusActions
          articleId={articleId}
          magazineId={id}
          status={article.status}
          saveFormId="article-edit-form"
        />
      </div>

      <ArticleForm
        action={action}
        formId="article-edit-form"
        defaultValues={{
          title: article.title,
          slug: article.slug,
          author: article.author,
          section: article.section,
          content: article.content,
          thumbnailUrl: article.thumbnailUrl,
          publishedAt: article.publishedAt,
          isCoverStory: article.isCoverStory,
        }}
      />
    </div>
  );
}

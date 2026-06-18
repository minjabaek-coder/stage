export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/admin/article-form";
import { ArticleStatusActions } from "@/components/admin/article-status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { updateArticle } from "@/actions/article-actions";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) notFound();

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateArticle(id, formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">기사 수정</h1>
          <StatusBadge status={article.status} />
        </div>
        <ArticleStatusActions
          articleId={article.id}
          status={article.status}
          saveFormId="article-edit-form"
        />
      </div>

      <div className="mx-auto max-w-3xl">
        <ArticleForm
          action={action}
          defaultValues={{
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            author: article.author,
            category: article.category,
            tags: article.tags,
            content: article.content,
            thumbnailUrl: article.thumbnailUrl,
            isFeatured: article.isFeatured,
            isPremium: article.isPremium,
            aiIndexable: article.aiIndexable,
            publishedAt: article.publishedAt,
          }}
          formId="article-edit-form"
        />
      </div>
    </div>
  );
}

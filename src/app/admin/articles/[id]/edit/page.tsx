export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/admin/article-form";
import { ArticleStatusActions } from "@/components/admin/article-status-actions";
import { ContributorLinkCard } from "@/components/admin/contributor-link-card";
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

  // 토큰 상태는 DB now()로 평가(서버 렌더에서 Date.now 미사용)
  const tokenRows = await prisma.$queryRawUnsafe<
    { expiresAt: Date | null; revokedAt: Date | null; active: boolean }[]
  >(
    `SELECT "expiresAt", "revokedAt",
            ("revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > now())) AS active
     FROM "ArticleEditToken" WHERE "articleId" = $1`,
    id,
  );
  const t = tokenRows[0];
  const tokenInitial = !t
    ? { exists: false, active: false, statusLabel: "발급된 링크 없음" }
    : t.revokedAt
      ? { exists: true, active: false, statusLabel: "회수됨" }
      : !t.active
        ? { exists: true, active: false, statusLabel: "만료됨" }
        : {
            exists: true,
            active: true,
            statusLabel: t.expiresAt
              ? `유효 · ${new Date(t.expiresAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 만료`
              : "유효 · 무기한",
          };

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

      <div className="mx-auto max-w-3xl space-y-6">
        <ContributorLinkCard articleId={article.id} initial={tokenInitial} />

        {/* updatedAt를 key로: 발행 등 revalidate로 새 데이터가 오면 폼을 remount해
            uncontrolled 입력의 defaultValue 변경(Base UI 경고)을 방지 */}
        <ArticleForm
          key={String(article.updatedAt)}
          action={action}
          defaultValues={{
            title: article.title,
            slug: article.slug,
            subtitle: article.subtitle,
            excerpt: article.excerpt,
            author: article.author,
            genre: article.genre,
            subCategory: article.subCategory,
            tags: article.tags,
            content: article.content,
            thumbnailUrl: article.thumbnailUrl,
            thumbnailFocusX: article.thumbnailFocusX,
            thumbnailFocusY: article.thumbnailFocusY,
            thumbnailZoom: article.thumbnailZoom,
            heroAspect: article.heroAspect,
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

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MainLayout } from "@/components/layouts/main-layout";
import { ArticleCard } from "@/components/public/article-card";
import { AdSlot } from "@/components/public/ad-slot";

export const metadata: Metadata = {
  title: "기사 | STAGE",
  description: "STAGE의 기사 — 리뷰·인터뷰·칼럼과 매거진 수록 기사.",
};

// 비프로덕션(preview·로컬)에서는 미발행 매거진의 기사도 노출 — 상세 페이지 정책과 동일.
const ALLOW_DRAFT = process.env.VERCEL_ENV !== "production";

// 매거진 기사는 excerpt 필드가 없어 본문 HTML에서 발췌 생성.
function excerptFromHtml(html: string, n = 140): string {
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).trim() + "…" : t;
}

type CardItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author: string;
  category: string;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  isPremium: boolean;
  href?: string;
  issueLabel?: string | null;
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const { genre } = await searchParams;

  const [standalone, magArticles] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "published",
        ...(genre ? { tags: { has: genre } } : {}),
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        author: true,
        category: true,
        publishedAt: true,
        thumbnailUrl: true,
        isPremium: true,
      },
    }),
    prisma.magazineArticle.findMany({
      where: ALLOW_DRAFT
        ? {}
        : { status: "published", magazine: { status: "published" } },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        author: true,
        section: true,
        publishedAt: true,
        thumbnailUrl: true,
        magazineId: true,
        magazine: { select: { issueNumber: true } },
      },
    }),
  ]);

  // 매거진 기사를 카드 형태로 정규화. 장르 필터는 tags가 없어 section 포함 여부로 근사.
  const magCards: CardItem[] = magArticles
    .filter((m) => !genre || (m.section ?? "").includes(genre))
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      title: m.title,
      excerpt: excerptFromHtml(m.content),
      author: m.author ?? "",
      category: m.section ?? "",
      publishedAt: m.publishedAt,
      thumbnailUrl: m.thumbnailUrl,
      isPremium: false,
      href: `/magazines/${m.magazineId}/${m.slug}`,
      issueLabel: `STAGE ${m.magazine.issueNumber}호`,
    }));

  const articles: CardItem[] = [...standalone, ...magCards].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  );

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold tracking-tight">기사</h1>
      <p className="mt-2 text-gray-500">
        {genre ? `${genre} · ` : ""}
        {articles.length}개의 기사
      </p>

      {articles.length === 0 ? (
        <div className="mt-24 text-center text-gray-400">
          {genre
            ? `'${genre}' 장르의 기사가 없습니다.`
            : "아직 발행된 기사가 없습니다."}
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <AdSlot placement="articles" className="mt-12 block" />
    </MainLayout>
  );
}

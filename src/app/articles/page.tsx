export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MainLayout } from "@/components/layouts/main-layout";
import { ArticleCard } from "@/components/public/article-card";
import { ArticleSubFilter } from "@/components/public/article-sub-filter";
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
  genre?: string | null;
  subCategory?: string | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  isPremium: boolean;
  href?: string;
  issueLabel?: string | null;
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; sub?: string }>;
}) {
  const { genre, sub } = await searchParams;

  const [standalone, magArticles] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: "published",
        ...(genre ? { genre } : {}),
        ...(sub ? { subCategory: sub } : {}),
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        author: true,
        category: true,
        genre: true,
        subCategory: true,
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

  // 매거진 기사를 카드 형태로 정규화. 대분류(장르)는 section 포함으로 근사.
  // 소분류(?sub=)는 매거진 기사에 없으므로 sub 필터가 켜지면 매거진 기사는 제외(단독기사 전용).
  const magCards: CardItem[] = (sub ? [] : magArticles)
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
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-gold-deep">
        Journal
      </span>
      <h1 className="font-headline mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        기사
      </h1>
      <div className="mt-3 flex items-start justify-between gap-4 border-b border-ink/10 pb-3">
        <p className="text-sm text-taupe">
          {[genre, sub].filter(Boolean).join(" · ")}
          {(genre || sub) && " · "}
          {articles.length}개의 기사
        </p>
        <ArticleSubFilter />
      </div>

      {articles.length === 0 ? (
        <div className="mt-24 text-center text-taupe">
          {genre || sub
            ? `해당 분류의 기사가 없습니다.`
            : "아직 발행된 기사가 없습니다."}
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <AdSlot placement="articles" className="mt-12 block" />
    </MainLayout>
  );
}

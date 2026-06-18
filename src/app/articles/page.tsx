export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ArticleCard } from "@/components/public/article-card";
import { AdSlot } from "@/components/public/ad-slot";

export const metadata: Metadata = {
  title: "기사 | STAGE",
  description: "STAGE의 단독 기사 — 리뷰·인터뷰·칼럼.",
};

export default async function ArticlesPage() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
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
  });

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">기사</h1>
        <p className="mt-2 text-gray-500">{articles.length}개의 기사</p>

        {articles.length === 0 ? (
          <div className="mt-24 text-center text-gray-400">
            아직 발행된 기사가 없습니다.
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

        <AdSlot placement="articles" className="mt-12 block" />
      </main>

      <Footer />
    </div>
  );
}

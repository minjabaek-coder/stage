export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { MainLayout } from "@/components/layouts/main-layout";
import { ArticleCard } from "@/components/public/article-card";
import { ArticleSubFilter } from "@/components/public/article-sub-filter";
import { AdSlot } from "@/components/public/ad-slot";

export const metadata: Metadata = {
  title: "기사 | STAGE",
  description: "STAGE의 기사 — 리뷰·인터뷰·칼럼과 매거진 수록 기사.",
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; sub?: string }>;
}) {
  const { genre, sub } = await searchParams;
  // 발행 전 기사는 관리자만 목록에 노출(환경 무관). 비admin은 발행본만.
  const admin = await isAdmin();

  // 단일 Article 모델(단독기사 + 매거진에서 이전된 기사 모두). 매거진 소속은
  // MagazinePage.articleId 역조회로 "실린 곳" 배지를 부여한다.
  const articles = await prisma.article.findMany({
    where: {
      ...(admin ? {} : { status: "published" }),
      ...(genre ? { genre } : {}),
      ...(sub ? { subCategory: sub } : {}),
    },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }],
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
      thumbnailFocusX: true,
      thumbnailFocusY: true,
      thumbnailZoom: true,
      isPremium: true,
      status: true,
    },
  });

  // 실린 곳: 이 기사를 싣는 매거진 페이지가 있으면 호수 배지 부여(기사당 첫 호).
  //
  // ⚠️ 매거진의 발행 상태를 반드시 본다. 빼면 **아직 나오지도 않은 호수를 광고**하게 되고
  //    (뷰어는 비admin에게 404라 눌러도 못 본다), 미발행 호의 존재·호수가 새어 나간다.
  const placements = articles.length
    ? await prisma.magazinePage.findMany({
        where: {
          articleId: { in: articles.map((a) => a.id) },
          ...(admin ? {} : { magazine: { status: "published" } }),
        },
        select: {
          articleId: true,
          magazine: { select: { issueNumber: true, status: true } },
        },
      })
    : [];
  const issueByArticle = new Map<string, { issue: number; draft: boolean }>();
  for (const p of placements) {
    if (p.articleId && !issueByArticle.has(p.articleId)) {
      issueByArticle.set(p.articleId, {
        issue: p.magazine.issueNumber,
        draft: p.magazine.status !== "published",
      });
    }
  }

  const cards = articles.map((a) => ({
    ...a,
    // 초안이 목록에 보이는 것은 관리자 미리보기이기 때문이다. 표시가 없으면
    // 이미 공개된 것으로 착각하기 쉬워, 라벨에 상태를 함께 적는다.
    issueLabel: [
      a.status !== "published" ? `${a.status === "submitted" ? "검토대기" : "초안"}` : null,
      issueByArticle.has(a.id)
        ? `STAGE ${issueByArticle.get(a.id)!.issue}호${
            issueByArticle.get(a.id)!.draft ? "(미발행)" : ""
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
  }));

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
          {cards.length}개의 기사
        </p>
        <ArticleSubFilter />
      </div>

      {cards.length === 0 ? (
        <div className="mt-24 text-center text-taupe">
          {genre || sub
            ? `해당 분류의 기사가 없습니다.`
            : "아직 발행된 기사가 없습니다."}
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      <AdSlot placement="articles" className="mt-12 block" />
    </MainLayout>
  );
}

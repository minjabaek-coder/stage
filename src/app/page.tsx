export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MainLayout } from "@/components/layouts/main-layout";
import { PastMagazines } from "@/components/public/past-magazines";
import { DocentChatFAB } from "@/components/public/docent-chat";
import { MaestroSection } from "@/components/public/maestro-section";
import { ArticleCard } from "@/components/public/article-card";
import { AdSlot } from "@/components/public/ad-slot";
import { LeftRail } from "@/components/public/left-rail";
import { MagazineCover } from "@/components/public/magazine-cover";

// v2 섹션 헤더 (page-home §B): 굵은 잉크 언더라인 + 모노 키커 + "전체보기 →"
function SectionHead({
  title,
  moreHref,
  moreLabel = "전체보기",
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b-2 border-ink pb-2.5">
      <h2 className="font-label text-[13px] font-bold uppercase tracking-[0.2em] text-ink">
        {title}
      </h2>
      {moreHref && (
        <Link
          href={moreHref}
          className="font-label text-[11px] text-gold-deep transition-colors hover:underline"
        >
          {moreLabel} →
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [publishedMagazines, recentArticles] = await Promise.all([
    prisma.magazine.findMany({
      where: { status: "published" },
      orderBy: { issueNumber: "desc" },
      // 구성형 표지 폴백용 — 첫 페이지 layout (비트맵 coverImageUrl 없을 때 ComposedPage 렌더)
      include: {
        pages: { orderBy: { sortOrder: "asc" }, take: 1, select: { layout: true } },
      },
    }),
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 3,
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
      },
    }),
  ]);

  const [latestMagazine, ...previousMagazines] = publishedMagazines;

  return (
    <MainLayout
      showGenreNav={false}
      sidebarHideRecent
      leftRail={<LeftRail magazines={publishedMagazines} />}
    >
      {/* Hero: 최신호 (v2 §C) */}
      {latestMagazine && (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-[clamp(180px,34%,260px)_1fr] sm:items-start">
          <Link
            href={`/magazines/${latestMagazine.id}`}
            className="group relative block aspect-[3/4] overflow-hidden bg-ink-deep"
          >
            <MagazineCover
              coverImageUrl={latestMagazine.coverImageUrl}
              contentType={latestMagazine.contentType}
              coverLayout={latestMagazine.pages?.[0]?.layout}
              title={latestMagazine.title}
              placeholderClass="text-3xl"
            />
            <div className="absolute inset-x-0 top-0 flex justify-between p-2">
              <span className="bg-gold px-1.5 py-0.5 font-label text-[8px] font-bold tracking-wider text-ink">
                NEW
              </span>
              {latestMagazine.contentType !== "image" && (
                <span className="rounded-sm bg-teal/90 px-1.5 py-0.5 font-label text-[8px] font-bold tracking-wider text-white">
                  인터랙티브
                </span>
              )}
            </div>
          </Link>

          <div>
            <span className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-gold-deep">
              최신호 · Issue {String(latestMagazine.issueNumber).padStart(2, "0")}
              {latestMagazine.publishedAt &&
                ` · ${new Date(latestMagazine.publishedAt).toLocaleDateString(
                  "ko-KR",
                  { year: "numeric", month: "long" }
                )}`}
            </span>
            <Link href={`/magazines/${latestMagazine.id}`}>
              <h1 className="font-headline mt-2 text-2xl font-bold leading-[1.18] tracking-tight transition-colors hover:text-gold-deep sm:text-[30px]">
                {latestMagazine.title}
              </h1>
            </Link>
            {latestMagazine.description && (
              <p className="mt-2.5 line-clamp-4 text-[13px] leading-[1.85] text-ink-muted">
                {latestMagazine.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/magazines/${latestMagazine.id}`}
                className="bg-ink px-5 py-2.5 font-label text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep"
              >
                매거진 보기
              </Link>
              <Link
                href="/ai-maestro"
                className="bg-teal px-5 py-2.5 font-label text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-teal-deep"
              >
                🎼 AI와 읽기
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 매거진 아카이브 (v2 §G) */}
      {previousMagazines.length > 0 && (
        <PastMagazines
          magazines={previousMagazines.map((m) => ({
            ...m,
            coverLayout: m.contentType === "composed" ? m.pages?.[0]?.layout ?? null : null,
          }))}
        />
      )}

      {/* 최신 기사 (v2 §D) */}
      {recentArticles.length > 0 && (
        <section className="mt-14">
          <SectionHead title="최신 기사" moreHref="/articles" />
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {recentArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* AI 마에스트로 인라인 (v2 §E) */}
      <MaestroSection />

      {/* 광고 (홈 인라인) — 위치는 추후 관리자 설정형(roadmap Phase 4) */}
      <AdSlot placement="home" className="mt-14 block" />

      <DocentChatFAB />
    </MainLayout>
  );
}

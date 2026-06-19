export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MainLayout } from "@/components/layouts/main-layout";
import { PastMagazines } from "@/components/public/past-magazines";
import { DocentChatFAB } from "@/components/public/docent-chat";
import { MaestroSection } from "@/components/public/maestro-section";
import { ArticleCard } from "@/components/public/article-card";
import { CultureEventCard } from "@/components/public/culture-event-card";
import { AdSlot } from "@/components/public/ad-slot";

export default async function HomePage() {
  const [publishedMagazines, recentArticles, recentEvents] = await Promise.all([
    prisma.magazine.findMany({
      where: { status: "published" },
      orderBy: { issueNumber: "desc" },
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
        publishedAt: true,
        thumbnailUrl: true,
        isPremium: true,
      },
    }),
    prisma.cultureEvent.findMany({
      where: { status: "published" },
      orderBy: { startDate: "desc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        type: true,
        genre: true,
        title: true,
        venue: true,
        startDate: true,
        endDate: true,
        thumbnailUrl: true,
        memberDiscount: true,
      },
    }),
  ]);

  const [latestMagazine, ...previousMagazines] = publishedMagazines;

  return (
    <MainLayout showGenreNav={false}>
      {/* Hero: 최신호 */}
      {latestMagazine && (
        <section className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:items-center">
          <Link
            href={`/magazines/${latestMagazine.id}`}
            className="group block overflow-hidden bg-[#f6f3f2]"
          >
            {latestMagazine.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={latestMagazine.coverImageUrl}
                alt={latestMagazine.title}
                className="aspect-[3/4] w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-[#eae7e7]">
                <span className="font-headline text-4xl opacity-20">STAGE</span>
              </div>
            )}
          </Link>

          <div>
            <span className="font-label text-xs font-semibold uppercase tracking-[0.15em] text-[#6f5c24]">
              최신호 · Issue {String(latestMagazine.issueNumber).padStart(2, "0")}
              {latestMagazine.publishedAt &&
                ` · ${new Date(latestMagazine.publishedAt).toLocaleDateString(
                  "ko-KR",
                  { year: "numeric", month: "long" }
                )}`}
            </span>
            <Link href={`/magazines/${latestMagazine.id}`}>
              <h1 className="font-headline mt-4 text-4xl leading-[1.1] tracking-tight transition-colors hover:text-[#6f5c24] md:text-5xl">
                {latestMagazine.title}
              </h1>
            </Link>
            {latestMagazine.description && (
              <p className="mt-5 leading-relaxed text-[#444748]">
                {latestMagazine.description}
              </p>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/magazines/${latestMagazine.id}`}
                className="inline-block bg-[#1c1b1b] px-7 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
              >
                매거진 보기
              </Link>
              <Link
                href="/ai-maestro"
                className="font-label text-[11px] font-bold uppercase tracking-widest text-[#1b6b6e] hover:underline"
              >
                🎼 AI와 읽기
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 최신 기사 */}
      {recentArticles.length > 0 && (
        <section className="mt-20">
          <div className="flex items-baseline justify-between border-b border-[#1c1b1b]/10 pb-4">
            <h2 className="font-label text-sm font-black uppercase tracking-[0.2em]">
              최신 기사
            </h2>
            <Link
              href="/articles"
              className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24] hover:underline"
            >
              전체보기 →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {recentArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      )}

      {/* 문화예술 */}
      {recentEvents.length > 0 && (
        <section className="mt-20">
          <div className="flex items-baseline justify-between border-b border-[#1c1b1b]/10 pb-4">
            <h2 className="font-label text-sm font-black uppercase tracking-[0.2em]">
              문화예술
            </h2>
            <Link
              href="/culture-events"
              className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24] hover:underline"
            >
              전체보기 →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {recentEvents.map((event) => (
              <CultureEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* 광고 (홈 인라인) */}
      <AdSlot placement="home" className="mt-16 block" />

      {/* AI 마에스트로 */}
      <div className="mt-20">
        <MaestroSection />
      </div>

      {/* 지난 호 */}
      {previousMagazines.length > 0 && (
        <PastMagazines magazines={previousMagazines} />
      )}

      <DocentChatFAB />
    </MainLayout>
  );
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { getCurrentUser } from "@/lib/auth";
import { BookmarkButton } from "@/components/public/bookmark-button";
import { ViewTracker } from "@/components/public/view-tracker";
import { ArticleMaestroWidget } from "@/components/public/article-maestro-widget";
import { DocentChatFAB } from "@/components/public/docent-chat";
import { formatKSTDate } from "@/lib/format";
import { heroAspectRatio } from "@/lib/article-taxonomy";

// 비프로덕션(preview·로컬)에서는 미발행(draft) 기사도 열람 허용 — 목록 정책과 동일.
const ALLOW_DRAFT = process.env.VERCEL_ENV !== "production";

// 본문(content)은 절대 포함하지 않는다 — 프리미엄 잠김 시 content가 서버 컴포넌트
// 스코프/ RSC 페이로드에 존재하지 못하게(누수 방지) 메타 필드만 조회.
const getArticleMeta = cache(async (slug: string) => {
  return prisma.article.findFirst({
    where: { slug, ...(ALLOW_DRAFT ? {} : { status: "published" }) },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      author: true,
      category: true,
      genre: true,
      subCategory: true,
      tags: true,
      thumbnailUrl: true,
      thumbnailFocusX: true,
      thumbnailFocusY: true,
      thumbnailZoom: true,
      heroAspect: true,
      isPremium: true,
      publishedAt: true,
    },
  });
});

// 권한이 확인된 경우에만 본문을 별도 조회.
async function getArticleContent(id: string): Promise<string> {
  const row = await prisma.article.findUnique({
    where: { id },
    select: { content: true },
  });
  return row?.content ?? "";
}

function sanitizeArticle(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleMeta(slug);
  if (!article) return { title: "Not Found" };

  // 메타에는 본문을 쓰지 않음(요약/제목만) — 누수 방지 겸 단순화
  const description = article.excerpt || article.title;

  return {
    title: `${article.title} | STAGE`,
    description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `/articles/${article.slug}`,
      publishedTime: article.publishedAt?.toISOString(),
      authors: article.author ? [article.author] : undefined,
      tags: article.tags,
      images: article.thumbnailUrl ? [{ url: article.thumbnailUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleMeta(slug);
  if (!article) notFound();

  // 실린 곳: 이 기사를 싣는 매거진 페이지(있으면). 첫 페이지로 딥링크.
  const placement = await prisma.magazinePage.findFirst({
    where: { articleId: article.id },
    orderBy: { pageNumber: "asc" },
    select: {
      pageNumber: true,
      magazineId: true,
      magazine: { select: { issueNumber: true } },
    },
  });

  const user = await getCurrentUser();
  // 프리미엄 기사는 로그인 회원만 본문 열람. 비회원(미로그인)은 미리보기.
  const locked = article.isPremium && !user;
  // 잠김이면 content를 아예 조회하지 않는다 → 페이로드에 존재 불가(RSC 누수 방지).
  const safeContent = locked
    ? null
    : sanitizeArticle(await getArticleContent(article.id));

  const bookmarked = user
    ? !!(await prisma.bookmark.findUnique({
        where: {
          userId_articleId: { userId: user.id, articleId: article.id },
        },
      }))
    : false;

  // 키커: 장르(없으면 유형, 그래도 없으면 레거시 category)를 주 라벨로,
  // 유형은 주 라벨과 다를 때만 보조로(중복 방지).
  const kickerPrimary =
    article.genre || article.subCategory || article.category;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ViewTracker type="article" id={article.id} />
      <SiteHeader />

      {article.thumbnailUrl && (
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: heroAspectRatio(article.heroAspect),
            maxHeight: "70vh",
          }}
        >
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: `${article.thumbnailFocusX ?? 50}% ${article.thumbnailFocusY ?? 50}%`,
              ...(article.thumbnailZoom && article.thumbnailZoom !== 1
                ? { transform: `scale(${article.thumbnailZoom})` }
                : {}),
            }}
          />
          {/* 하단을 종이색으로 페이드 — 에디토리얼 헤더와 자연스럽게 연결 */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-paper" />
        </div>
      )}

      <main className="mx-auto max-w-[680px] px-6 pb-16 pt-10">
        {/* 키커: 장르 · 유형 + 프리미엄 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {kickerPrimary && (
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-gold-deep">
              {kickerPrimary}
            </span>
          )}
          {article.subCategory && article.subCategory !== kickerPrimary && (
            <span className="font-label text-[11px] font-semibold tracking-wide text-taupe">
              · {article.subCategory}
            </span>
          )}
          {article.isPremium && (
            <span className="bg-gold-deep px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-white">
              프리미엄
            </span>
          )}
        </div>

        <h1 className="font-headline mt-3 text-[28px] font-bold leading-[1.25] tracking-tight text-ink md:text-[40px] md:leading-[1.2]">
          {article.title}
        </h1>

        <div className="mt-5 flex items-center gap-2 text-sm text-taupe">
          {article.author && (
            <span className="font-medium text-ink-muted">{article.author}</span>
          )}
          {article.publishedAt && (
            <>
              {article.author && <span className="text-taupe/50">·</span>}
              <span className="font-label text-xs tracking-wide text-date">
                {formatKSTDate(article.publishedAt)}
              </span>
            </>
          )}
        </div>

        {placement && (
          <Link
            href={`/magazines/${placement.magazineId}?page=${placement.pageNumber}`}
            className="mt-5 inline-flex items-center gap-1.5 border border-gold-deep/30 bg-gold-deep/5 px-3.5 py-1.5 font-label text-xs font-semibold tracking-wide text-gold-deep transition-colors hover:bg-gold-deep/10"
          >
            실린 곳 · STAGE {placement.magazine.issueNumber}호 {placement.pageNumber}페이지에서 보기 →
          </Link>
        )}

        {article.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="bg-surface-warm px-2 py-0.5 font-label text-[11px] tracking-wide text-taupe"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {user && (
          <div className="mt-6">
            <BookmarkButton
              articleId={article.id}
              initialBookmarked={bookmarked}
            />
          </div>
        )}

        <div className="mt-8 border-t border-ink/10" />

        {locked ? (
          <div className="mt-8">
            {article.excerpt && (
              <p className="text-lg leading-[1.9] text-ink-muted">
                {article.excerpt}
              </p>
            )}
            <div className="mt-8 border border-gold-deep/20 bg-surface-warm p-8 text-center">
              <p className="font-headline text-2xl text-ink">프리미엄 기사입니다</p>
              <p className="mt-3 text-sm text-ink-muted">
                STAGE 회원으로 로그인하면 전체 내용을 읽을 수 있습니다.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/auth/login"
                  className="bg-ink px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep"
                >
                  로그인
                </Link>
                <Link
                  href="/auth/signup"
                  className="font-label text-[11px] font-bold uppercase tracking-widest text-gold-deep hover:underline"
                >
                  회원가입
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="prose prose-stone mt-8 max-w-none leading-[1.9] prose-headings:font-headline prose-headings:text-ink prose-p:text-ink-muted prose-a:text-gold-deep prose-strong:text-ink prose-img:w-full prose-blockquote:border-gold-deep prose-blockquote:text-ink-muted"
            dangerouslySetInnerHTML={{ __html: safeContent ?? "" }}
          />
        )}

        <ArticleMaestroWidget title={article.title} />

        <div className="mt-12 border-t border-ink/10 pt-6">
          <Link
            href="/articles"
            className="font-label text-xs uppercase tracking-wider text-gold-deep transition-colors hover:underline"
          >
            ← 기사 목록
          </Link>
        </div>
      </main>

      <Footer />
      <DocentChatFAB />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";

// 본문(content)은 절대 포함하지 않는다 — 프리미엄 잠김 시 content가 서버 컴포넌트
// 스코프/ RSC 페이로드에 존재하지 못하게(누수 방지) 메타 필드만 조회.
const getArticleMeta = cache(async (slug: string) => {
  return prisma.article.findFirst({
    where: { slug, status: "published" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      author: true,
      category: true,
      tags: true,
      thumbnailUrl: true,
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

  const user = await getCurrentUser();
  // 프리미엄 기사는 로그인 회원만 본문 열람. 비회원(미로그인)은 미리보기.
  const locked = article.isPremium && !user;
  // 잠김이면 content를 아예 조회하지 않는다 → 페이로드에 존재 불가(RSC 누수 방지).
  const safeContent = locked
    ? null
    : sanitizeArticle(await getArticleContent(article.id));

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {article.thumbnailUrl && (
        <div className="relative h-64 w-full sm:h-80 md:h-96">
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center gap-2">
          {article.category && (
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-[#6f5c24]">
              {article.category}
            </span>
          )}
          {article.isPremium && (
            <Badge className="bg-[#6f5c24] text-white">프리미엄</Badge>
          )}
        </div>

        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {article.title}
        </h1>

        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          {article.author && <span>{article.author}</span>}
          {article.publishedAt && (
            <>
              {article.author && <span>·</span>}
              <span>
                {new Date(article.publishedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>

        {article.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {locked ? (
          <div className="mt-10">
            {article.excerpt && (
              <p className="text-lg leading-relaxed text-gray-700">
                {article.excerpt}
              </p>
            )}
            <div className="mt-8 rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-8 text-center">
              <p className="font-headline text-2xl">프리미엄 기사입니다</p>
              <p className="mt-3 text-sm text-[#444748]">
                STAGE 회원으로 로그인하면 전체 내용을 읽을 수 있습니다.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/auth/login"
                  className="bg-[#1c1b1b] px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
                >
                  로그인
                </Link>
                <Link
                  href="/auth/signup"
                  className="font-label text-[11px] font-bold uppercase tracking-widest text-[#6f5c24] hover:underline"
                >
                  회원가입
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="prose prose-gray mt-10 max-w-none"
            dangerouslySetInnerHTML={{ __html: safeContent ?? "" }}
          />
        )}

        <div className="mt-12 border-t border-gray-100 pt-6">
          <Link
            href="/articles"
            className="font-label text-xs uppercase tracking-wider text-[#6f5c24] hover:underline"
          >
            ← 기사 목록
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

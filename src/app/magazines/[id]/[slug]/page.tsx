export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ViewTracker } from "@/components/public/view-tracker";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string; slug: string }>;
};

const getArticle = cache(async (magazineId: string, slug: string) => {
  return prisma.magazineArticle.findFirst({
    // Gate on the parent magazine too: a published article inside a draft/
    // unpublished issue must not be reachable by direct URL.
    where: {
      magazineId,
      slug,
      status: "published",
      magazine: { status: "published" },
    },
    include: { magazine: true },
  });
});

const getSiblings = cache(async (magazineId: string, sortOrder: number) => {
  const [prev, next] = await Promise.all([
    prisma.magazineArticle.findFirst({
      where: { magazineId, status: "published", sortOrder: { lt: sortOrder } },
      orderBy: { sortOrder: "desc" },
      select: { slug: true, title: true },
    }),
    prisma.magazineArticle.findFirst({
      where: { magazineId, status: "published", sortOrder: { gt: sortOrder } },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, title: true },
    }),
  ]);
  return { prev, next };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, slug } = await params;
  const article = await getArticle(id, slug);

  if (!article) return { title: "Not Found" };

  const description = article.content.replace(/<[^>]+>/g, "").slice(0, 160);
  const image = article.thumbnailUrl || article.magazine.coverImageUrl;

  return {
    title: `${article.title} | ${article.magazine.title} | STAGE`,
    description,
    alternates: { canonical: `/magazines/${id}/${slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `/magazines/${id}/${slug}`,
      publishedTime: article.publishedAt?.toISOString(),
      authors: article.author ? [article.author] : undefined,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id, slug } = await params;
  const article = await getArticle(id, slug);

  if (!article) notFound();

  const { prev, next } = await getSiblings(id, article.sortOrder);

  const safeContent = sanitizeHtml(article.content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
    },
  });

  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <ViewTracker type="magazine" id={article.magazineId} />
      <SiteHeader />

      {article.thumbnailUrl ? (
        <div className="relative h-64 w-full sm:h-80 md:h-[28rem]">
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
        </div>
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-[#eae7e7] sm:h-64">
          <span className="font-headline text-3xl opacity-20">STAGE</span>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Magazine context */}
        <Link
          href={`/magazines/${article.magazineId}`}
          className="font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6f5c24] hover:underline"
        >
          STAGE Issue {String(article.magazine.issueNumber).padStart(2, "0")}
          {article.section && ` / ${article.section}`}
        </Link>

        <h1 className="font-headline mt-4 text-3xl md:text-5xl leading-tight tracking-tight">
          {article.title}
        </h1>

        <div className="mt-4 flex items-center gap-3 text-sm text-[#444748]">
          {article.author && (
            <span className="font-label font-semibold">{article.author}</span>
          )}
          {article.publishedAt && (
            <>
              {article.author && <span>·</span>}
              <time>
                {new Date(article.publishedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </>
          )}
        </div>

        <article
          className="prose prose-gray mt-10 max-w-none"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />

        {/* Navigation */}
        <div className="mt-16 border-t border-[#1c1b1b]/10 pt-8">
          <div className="flex justify-between items-start gap-4">
            <div>
              {prev && (
                <Link
                  href={`/magazines/${id}/${prev.slug}`}
                  className="group"
                >
                  <span className="font-label text-[10px] uppercase tracking-wider opacity-50 block mb-1">
                    이전 글
                  </span>
                  <span className="font-headline text-lg group-hover:text-[#6f5c24] transition-colors">
                    {prev.title}
                  </span>
                </Link>
              )}
            </div>
            <div className="text-right">
              {next && (
                <Link
                  href={`/magazines/${id}/${next.slug}`}
                  className="group"
                >
                  <span className="font-label text-[10px] uppercase tracking-wider opacity-50 block mb-1">
                    다음 글
                  </span>
                  <span className="font-headline text-lg group-hover:text-[#6f5c24] transition-colors">
                    {next.title}
                  </span>
                </Link>
              )}
            </div>
          </div>

          <div className="mt-8">
            <Link
              href={`/magazines/${id}`}
              className="font-label text-sm hover:text-[#6f5c24] transition-colors"
            >
              ← 목차로 돌아가기
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

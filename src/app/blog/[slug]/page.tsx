export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ViewTracker } from "@/components/public/view-tracker";
import type { Metadata } from "next";

const getPost = cache(async (slug: string) => {
  return prisma.blogPost.findFirst({
    where: { slug, status: "published" },
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return { title: "Not Found" };

  const description = post.content.replace(/<[^>]+>/g, "").slice(0, 160);

  return {
    title: `${post.title} | STAGE Blog`,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.author ? [post.author] : undefined,
      tags: post.tags,
      images: post.thumbnailUrl ? [{ url: post.thumbnailUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  const safeContent = sanitizeHtml(post.content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
    },
  });

  return (
    <div className="min-h-screen bg-white">
      <ViewTracker type="blog" id={post.id} />
      <SiteHeader />

      {post.thumbnailUrl ? (
        <div className="relative h-64 w-full sm:h-80 md:h-96">
          <img
            src={post.thumbnailUrl}
            alt={post.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
        </div>
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 sm:h-64">
          <span className="text-3xl font-bold tracking-widest text-white/80">
            STAGE
          </span>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>

        <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
          {post.author && <span>{post.author}</span>}
          {post.publishedAt && (
            <>
              {post.author && <span>·</span>}
              <time>
                {new Date(post.publishedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </>
          )}
        </div>

        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <article
          className="prose prose-gray mt-10 max-w-none"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />

        <div className="mt-16 border-t pt-8">
          <Link
            href="/blog"
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            &larr; 목록으로
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

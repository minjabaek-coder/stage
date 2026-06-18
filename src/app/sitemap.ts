import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

// 운영 DB(IPv6) 빌드 호환 위해 동적 생성.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [magazines, blogPosts, articles] = await Promise.all([
    prisma.magazine.findMany({
      where: { status: "published" },
      select: {
        id: true,
        updatedAt: true,
        articles: {
          where: { status: "published" },
          select: { slug: true, updatedAt: true },
        },
      },
    }),
    prisma.blogPost.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.article.findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/magazines`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/articles`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const magazineRoutes: MetadataRoute.Sitemap = magazines.flatMap((m) => [
    {
      url: `${SITE_URL}/magazines/${m.id}`,
      lastModified: m.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...m.articles.map((a) => ({
      url: `${SITE_URL}/magazines/${m.id}/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ]);

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/articles/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...magazineRoutes,
    ...blogRoutes,
    ...articleRoutes,
  ];
}

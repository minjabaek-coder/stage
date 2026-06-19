export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { BlogCard } from "@/components/public/blog-card";
import { MainLayout } from "@/components/layouts/main-layout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | STAGE",
  description: "STAGE 블로그",
};

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      publishedAt: true,
      tags: true,
      thumbnailUrl: true,
      status: true,
      content: false,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
      <p className="mt-2 text-gray-500">{posts.length}개의 글</p>

      {posts.length === 0 ? (
        <div className="mt-24 text-center text-gray-400">
          아직 발행된 글이 없습니다.
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </MainLayout>
  );
}

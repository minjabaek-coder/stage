"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";
import { generateEmbeddings } from "@/lib/rag";

function parseTags(tags: string): string[] {
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

function revalidateBlogPaths(id?: string, slug?: string) {
  if (id) revalidatePath(`/admin/blog/${id}/edit`);
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath("/");
}

const blogPostSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용 가능합니다"),
  author: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  content: z.string().optional().default(""),
  thumbnailUrl: z.string().optional().default(""),
  publishedAt: z.string().optional().default(""),
});

export async function createBlogPost(formData: FormData) {
  const parsed = blogPostSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    author: formData.get("author"),
    tags: formData.get("tags"),
    content: formData.get("content"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    publishedAt: formData.get("publishedAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await prisma.blogPost.findUnique({
    where: { slug: parsed.data.slug },
  });

  if (existing) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const post = await prisma.blogPost.create({
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      author: parsed.data.author || "",
      tags: parseTags(parsed.data.tags),
      content: parsed.data.content || "",
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
    },
  });

  redirect(`/admin/blog/${post.id}/edit`);
}

export async function updateBlogPost(id: string, formData: FormData) {
  const parsed = blogPostSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    author: formData.get("author"),
    tags: formData.get("tags"),
    content: formData.get("content"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    publishedAt: formData.get("publishedAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await prisma.blogPost.findFirst({
    where: {
      slug: parsed.data.slug,
      NOT: { id },
    },
  });

  if (existing) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const currentPost = await prisma.blogPost.findUnique({
    where: { id },
    select: { content: true, title: true, status: true, thumbnailUrl: true },
  });

  const newThumbnail = parsed.data.thumbnailUrl || null;

  await prisma.blogPost.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      author: parsed.data.author || "",
      tags: parseTags(parsed.data.tags),
      content: parsed.data.content || "",
      thumbnailUrl: newThumbnail,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
    },
  });

  // Replaced thumbnail → remove the old Storage file (no-op for external URLs)
  if (currentPost?.thumbnailUrl && currentPost.thumbnailUrl !== newThumbnail) {
    await deleteUploadedFile(currentPost.thumbnailUrl);
  }

  revalidateBlogPaths(id, parsed.data.slug);

  // Re-embed only if published and content/title changed
  const contentChanged =
    currentPost &&
    currentPost.status === "published" &&
    (currentPost.content !== (parsed.data.content || "") ||
      currentPost.title !== parsed.data.title);

  if (contentChanged) {
    generateEmbeddings(id).catch((err) =>
      console.error("[RAG] Embedding generation failed:", err)
    );
  }

  return { success: true };
}

export async function publishBlogPost(id: string) {
  const post = await prisma.blogPost.findUnique({ where: { id } });

  if (!post) {
    return { error: "블로그 글을 찾을 수 없습니다" };
  }

  if (!post.title || !post.content) {
    return { error: "제목과 본문이 필요합니다" };
  }

  revalidateBlogPaths(id, post.slug);
  generateEmbeddings(id, { autoPublish: true }).catch((err) =>
    console.error("[RAG] Embedding generation failed:", err)
  );
  return { success: true };
}

export async function unpublishBlogPost(id: string) {
  const post = await prisma.blogPost.findUnique({ where: { id } });

  if (!post) {
    return { error: "블로그 글을 찾을 수 없습니다" };
  }

  await prisma.blogPost.update({
    where: { id },
    data: { status: "draft" },
  });

  revalidateBlogPaths(id, post.slug);
  return { success: true };
}

export async function deleteBlogPost(id: string) {
  const post = await prisma.blogPost.findUnique({ where: { id } });

  if (!post) {
    return { error: "블로그 글을 찾을 수 없습니다" };
  }

  await prisma.blogPost.delete({ where: { id } });

  if (post.thumbnailUrl) {
    await deleteUploadedFile(post.thumbnailUrl);
  }

  revalidateBlogPaths(undefined, post.slug);
  redirect("/admin/blog");
}

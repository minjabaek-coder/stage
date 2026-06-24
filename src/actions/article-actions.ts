"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";
import { generateArticleEmbeddings } from "@/lib/rag";

function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function revalidateArticlePaths(id?: string, slug?: string) {
  if (id) revalidatePath(`/admin/articles/${id}/edit`);
  if (slug) revalidatePath(`/articles/${slug}`);
  revalidatePath("/admin/articles");
  revalidatePath("/articles");
  revalidatePath("/");
}

const articleSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용 가능합니다"),
  excerpt: z.string().optional().default(""),
  author: z.string().optional().default(""),
  genre: z.string().optional().default(""), // 대분류(예술 장르)
  subCategory: z.string().optional().default(""), // 소분류(형식)
  tags: z.string().optional().default(""),
  content: z.string().optional().default(""),
  thumbnailUrl: z.string().optional().default(""),
  thumbnailFocusX: z.coerce.number().optional(),
  thumbnailFocusY: z.coerce.number().optional(),
  thumbnailZoom: z.coerce.number().optional(),
  heroAspect: z.string().optional().default(""),
  isFeatured: z.boolean().optional().default(false),
  isPremium: z.boolean().optional().default(false),
  aiIndexable: z.boolean().optional().default(true),
  publishedAt: z.string().optional().default(""),
});

function readForm(formData: FormData) {
  return articleSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt"),
    author: formData.get("author"),
    genre: formData.get("genre"),
    subCategory: formData.get("subCategory"),
    tags: formData.get("tags"),
    content: formData.get("content"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    thumbnailFocusX: formData.get("thumbnailFocusX") ?? undefined,
    thumbnailFocusY: formData.get("thumbnailFocusY") ?? undefined,
    thumbnailZoom: formData.get("thumbnailZoom") ?? undefined,
    heroAspect: formData.get("heroAspect"),
    isFeatured: formData.get("isFeatured") === "on",
    isPremium: formData.get("isPremium") === "on",
    aiIndexable: formData.get("aiIndexable") === "on",
    publishedAt: formData.get("publishedAt"),
  });
}

export async function createArticle(formData: FormData) {
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.article.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const article = await prisma.article.create({
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      author: parsed.data.author || "",
      genre: parsed.data.genre || null,
      subCategory: parsed.data.subCategory || null,
      category: parsed.data.subCategory || "", // 레거시 미러(소분류)
      tags: parseTags(parsed.data.tags),
      content: parsed.data.content || "",
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      thumbnailFocusX: parsed.data.thumbnailFocusX ?? null,
      thumbnailFocusY: parsed.data.thumbnailFocusY ?? null,
      thumbnailZoom: parsed.data.thumbnailZoom ?? null,
      heroAspect: parsed.data.heroAspect || null,
      isFeatured: parsed.data.isFeatured,
      isPremium: parsed.data.isPremium,
      aiIndexable: parsed.data.aiIndexable,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
    },
  });

  redirect(`/admin/articles/${article.id}/edit`);
}

export async function updateArticle(id: string, formData: FormData) {
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const conflict = await prisma.article.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (conflict) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const current = await prisma.article.findUnique({
    where: { id },
    select: { thumbnailUrl: true, status: true },
  });

  const newThumbnail = parsed.data.thumbnailUrl || null;

  await prisma.article.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      author: parsed.data.author || "",
      genre: parsed.data.genre || null,
      subCategory: parsed.data.subCategory || null,
      category: parsed.data.subCategory || "", // 레거시 미러(소분류)
      tags: parseTags(parsed.data.tags),
      content: parsed.data.content || "",
      thumbnailUrl: newThumbnail,
      thumbnailFocusX: parsed.data.thumbnailFocusX ?? null,
      thumbnailFocusY: parsed.data.thumbnailFocusY ?? null,
      thumbnailZoom: parsed.data.thumbnailZoom ?? null,
      heroAspect: parsed.data.heroAspect || null,
      isFeatured: parsed.data.isFeatured,
      isPremium: parsed.data.isPremium,
      aiIndexable: parsed.data.aiIndexable,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
    },
  });

  // Replaced thumbnail → remove the old Storage file (no-op for external URLs)
  if (current?.thumbnailUrl && current.thumbnailUrl !== newThumbnail) {
    await deleteUploadedFile(current.thumbnailUrl);
  }

  // 발행된 기사면 본문/색인 변경 반영을 위해 재임베딩(aiIndexable는 함수가 판단)
  if (current?.status === "published") {
    generateArticleEmbeddings(id).catch((err) =>
      console.error("[RAG] Article embedding failed:", err)
    );
  }

  revalidateArticlePaths(id, parsed.data.slug);
  redirect("/admin/articles");
}

export async function publishArticle(id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return { error: "기사를 찾을 수 없습니다" };
  if (!article.title || !article.content) {
    return { error: "제목과 본문이 필요합니다" };
  }

  await prisma.article.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: article.publishedAt ?? new Date(),
    },
  });

  // 발행 = 기고자 토큰 무효화(자동). 재발급은 관리자 수동(#7).
  await prisma.articleEditToken.updateMany({
    where: { articleId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // RAG: 발행 시 본문 임베딩(aiIndexable=true인 경우). best-effort.
  generateArticleEmbeddings(id).catch((err) =>
    console.error("[RAG] Article embedding failed:", err)
  );

  revalidateArticlePaths(id, article.slug);
  return { success: true };
}

export async function unpublishArticle(id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return { error: "기사를 찾을 수 없습니다" };

  await prisma.article.update({
    where: { id },
    data: { status: "draft" },
  });

  revalidateArticlePaths(id, article.slug);
  return { success: true };
}

export async function deleteArticle(id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return { error: "기사를 찾을 수 없습니다" };

  await prisma.article.delete({ where: { id } });

  if (article.thumbnailUrl) {
    await deleteUploadedFile(article.thumbnailUrl);
  }

  revalidateArticlePaths(undefined, article.slug);
  redirect("/admin/articles");
}

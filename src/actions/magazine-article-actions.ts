"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";

function revalidateArticlePaths(magazineId: string) {
  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath(`/magazines/${magazineId}`);
  revalidatePath("/admin/magazines");
  revalidatePath("/");
}

const articleSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용 가능합니다"),
  author: z.string().optional().default(""),
  section: z.string().optional().default(""),
  content: z.string().optional().default(""),
  thumbnailUrl: z.string().optional().default(""),
  publishedAt: z.string().optional().default(""),
  isCoverStory: z.string().optional().default(""),
});

export async function createArticle(
  magazineId: string,
  _prevState: unknown,
  formData: FormData
) {
  const parsed = articleSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    author: formData.get("author"),
    section: formData.get("section"),
    content: formData.get("content"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    publishedAt: formData.get("publishedAt"),
    isCoverStory: formData.get("isCoverStory"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await prisma.magazineArticle.findUnique({
    where: { magazineId_slug: { magazineId, slug: parsed.data.slug } },
  });

  if (existing) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const maxOrder = await prisma.magazineArticle.aggregate({
    where: { magazineId },
    _max: { sortOrder: true },
  });

  const article = await prisma.magazineArticle.create({
    data: {
      magazineId,
      title: parsed.data.title,
      slug: parsed.data.slug,
      author: parsed.data.author || "",
      section: parsed.data.section || "",
      content: parsed.data.content || "",
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
      isCoverStory: parsed.data.isCoverStory === "true",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  redirect(`/admin/magazines/${magazineId}/articles/${article.id}/edit`);
}

export async function updateArticle(
  id: string,
  magazineId: string,
  _prevState: unknown,
  formData: FormData
) {
  const parsed = articleSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    author: formData.get("author"),
    section: formData.get("section"),
    content: formData.get("content"),
    thumbnailUrl: formData.get("thumbnailUrl"),
    publishedAt: formData.get("publishedAt"),
    isCoverStory: formData.get("isCoverStory"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await prisma.magazineArticle.findFirst({
    where: {
      magazineId,
      slug: parsed.data.slug,
      NOT: { id },
    },
  });

  if (existing) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const isCover = parsed.data.isCoverStory === "true";
  const newThumbnail = parsed.data.thumbnailUrl || null;

  const current = await prisma.magazineArticle.findUnique({
    where: { id },
    select: { thumbnailUrl: true },
  });

  if (isCover) {
    await prisma.magazineArticle.updateMany({
      where: { magazineId, isCoverStory: true, NOT: { id } },
      data: { isCoverStory: false },
    });
  }

  await prisma.magazineArticle.update({
    where: { id },
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      author: parsed.data.author || "",
      section: parsed.data.section || "",
      content: parsed.data.content || "",
      thumbnailUrl: newThumbnail,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
      isCoverStory: isCover,
    },
  });

  // Replaced thumbnail → remove the old Storage file (no-op for external URLs)
  if (current?.thumbnailUrl && current.thumbnailUrl !== newThumbnail) {
    await deleteUploadedFile(current.thumbnailUrl);
  }

  if (isCover && parsed.data.thumbnailUrl) {
    await prisma.magazine.update({
      where: { id: magazineId },
      data: { coverImageUrl: parsed.data.thumbnailUrl || null },
    });
  }

  revalidateArticlePaths(magazineId);
  return { success: true };
}

export async function publishArticle(id: string) {
  const article = await prisma.magazineArticle.findUnique({ where: { id } });
  if (!article) return { error: "아티클을 찾을 수 없습니다" };

  await prisma.magazineArticle.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: article.publishedAt ?? new Date(),
    },
  });

  revalidateArticlePaths(article.magazineId);
  return { success: true };
}

export async function unpublishArticle(id: string) {
  const article = await prisma.magazineArticle.findUnique({ where: { id } });
  if (!article) return { error: "아티클을 찾을 수 없습니다" };

  await prisma.magazineArticle.update({
    where: { id },
    data: { status: "draft" },
  });

  revalidateArticlePaths(article.magazineId);
  return { success: true };
}

export async function deleteArticle(id: string, magazineId: string) {
  const article = await prisma.magazineArticle.findUnique({ where: { id } });
  if (!article) return { error: "아티클을 찾을 수 없습니다" };

  await prisma.magazineArticle.delete({ where: { id } });

  if (article.thumbnailUrl) {
    await deleteUploadedFile(article.thumbnailUrl);
    // If this article's thumbnail was the magazine cover, clear the now-dangling
    // reference so the cover doesn't point at a deleted file.
    await prisma.magazine.updateMany({
      where: { id: magazineId, coverImageUrl: article.thumbnailUrl },
      data: { coverImageUrl: null },
    });
  }

  revalidateArticlePaths(magazineId);
  redirect(`/admin/magazines/${magazineId}/edit`);
}

export async function reorderArticles(
  magazineId: string,
  orderedIds: string[]
) {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.magazineArticle.update({
        where: { id: orderedIds[i] },
        data: { sortOrder: -(i + 1) },
      });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.magazineArticle.update({
        where: { id: orderedIds[i] },
        data: { sortOrder: i },
      });
    }
  });

  revalidateArticlePaths(magazineId);
  return { success: true };
}

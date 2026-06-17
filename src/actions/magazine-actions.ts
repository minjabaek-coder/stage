"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";

const magazineSchema = z.object({
  issueNumber: z.coerce.number().int().positive("호수는 양수여야 합니다"),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  description: z.string().optional().default(""),
  publishedAt: z.string().optional().default(""),
  contentType: z.enum(["image", "web"]).optional().default("image"),
});

export async function createMagazine(formData: FormData) {
  const parsed = magazineSchema.safeParse({
    issueNumber: formData.get("issueNumber"),
    title: formData.get("title"),
    description: formData.get("description"),
    publishedAt: formData.get("publishedAt"),
    contentType: formData.get("contentType"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await prisma.magazine.findUnique({
    where: { issueNumber: parsed.data.issueNumber },
  });

  if (existing) {
    return { error: `호수 ${parsed.data.issueNumber}은(는) 이미 존재합니다` };
  }

  const magazine = await prisma.magazine.create({
    data: {
      issueNumber: parsed.data.issueNumber,
      title: parsed.data.title,
      description: parsed.data.description || null,
      contentType: parsed.data.contentType,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
    },
  });

  redirect(`/admin/magazines/${magazine.id}/edit`);
}

export async function updateMagazine(id: string, formData: FormData) {
  const parsed = magazineSchema.safeParse({
    issueNumber: formData.get("issueNumber"),
    title: formData.get("title"),
    description: formData.get("description"),
    publishedAt: formData.get("publishedAt"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await prisma.magazine.findFirst({
    where: {
      issueNumber: parsed.data.issueNumber,
      NOT: { id },
    },
  });

  if (existing) {
    return { error: `호수 ${parsed.data.issueNumber}은(는) 이미 존재합니다` };
  }

  await prisma.magazine.update({
    where: { id },
    data: {
      issueNumber: parsed.data.issueNumber,
      title: parsed.data.title,
      description: parsed.data.description || null,
      publishedAt: parsed.data.publishedAt
        ? new Date(parsed.data.publishedAt)
        : null,
    },
  });

  revalidatePath(`/admin/magazines/${id}/edit`);
  revalidatePath("/admin/magazines");
  revalidatePath("/");
  return { success: true };
}

export async function publishMagazine(id: string) {
  const magazine = await prisma.magazine.findUnique({
    where: { id },
    include: {
      _count: {
        select: { pages: true, articles: true },
      },
    },
  });

  if (!magazine) {
    return { error: "매거진을 찾을 수 없습니다" };
  }

  if (magazine.contentType === "image" && magazine._count.pages === 0) {
    return { error: "최소 1장의 페이지가 필요합니다" };
  }

  if (magazine.contentType === "web" && magazine._count.articles === 0) {
    return { error: "최소 1개의 아티클이 필요합니다" };
  }

  await prisma.magazine.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: magazine.publishedAt ?? new Date(),
    },
  });

  revalidatePath(`/admin/magazines/${id}/edit`);
  revalidatePath("/admin/magazines");
  revalidatePath("/");
  return { success: true };
}

export async function unpublishMagazine(id: string) {
  await prisma.magazine.update({
    where: { id },
    data: { status: "unpublished" },
  });

  revalidatePath(`/admin/magazines/${id}/edit`);
  revalidatePath("/admin/magazines");
  revalidatePath("/");
  return { success: true };
}

export async function deleteMagazine(id: string) {
  // Collect all Storage-backed URLs before deletion. Cascade removes the DB
  // rows (pages, articles) but NOT the Supabase Storage objects, so gather them
  // up front and clean them after the DB delete to avoid orphaned files.
  const magazine = await prisma.magazine.findUnique({
    where: { id },
    select: {
      coverImageUrl: true,
      pages: { select: { imageUrl: true } },
      articles: { select: { thumbnailUrl: true } },
    },
  });

  if (!magazine) {
    return { error: "매거진을 찾을 수 없습니다" };
  }

  await prisma.magazine.delete({ where: { id } });

  const urls = new Set<string>();
  if (magazine.coverImageUrl) urls.add(magazine.coverImageUrl);
  for (const page of magazine.pages) urls.add(page.imageUrl);
  for (const article of magazine.articles) {
    if (article.thumbnailUrl) urls.add(article.thumbnailUrl);
  }

  // Best-effort cleanup; failures are logged inside deleteUploadedFile and must
  // not block the deletion that already succeeded in the DB.
  await Promise.allSettled([...urls].map((url) => deleteUploadedFile(url)));

  revalidatePath("/admin/magazines");
  revalidatePath("/");
  redirect("/admin/magazines");
}

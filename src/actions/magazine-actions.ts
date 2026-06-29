"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";
import { generateMagazineEmbeddings, deleteContentChunks } from "@/lib/rag";

function revalidateMagazinePaths(id?: string) {
  if (id) revalidatePath(`/admin/magazines/${id}/edit`);
  revalidatePath("/admin/magazines");
  revalidatePath("/");
}

const magazineSchema = z.object({
  issueNumber: z.coerce.number().int().positive("호수는 양수여야 합니다"),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  description: z.string().optional().default(""),
  publishedAt: z.string().optional().default(""),
  contentType: z.enum(["image", "web", "composed"]).optional().default("image"),
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

  revalidateMagazinePaths(id);
  return { success: true };
}

export async function publishMagazine(id: string) {
  const magazine = await prisma.magazine.findUnique({
    where: { id },
    include: {
      _count: {
        select: { pages: true },
      },
    },
  });

  if (!magazine) {
    return { error: "매거진을 찾을 수 없습니다" };
  }

  // 매거진은 페이지로 구성된다(기사는 독립 Article). 이미지·구성형 모두 최소 1장 필요.
  if (magazine._count.pages === 0) {
    return { error: "최소 1장의 페이지가 필요합니다" };
  }

  await prisma.magazine.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: magazine.publishedAt ?? new Date(),
    },
  });

  // RAG: 발행 시 구성형 페이지 텍스트 색인(기사 연결 페이지 제외). best-effort.
  generateMagazineEmbeddings(id).catch((err) =>
    console.error("[RAG] Magazine embedding failed:", err)
  );

  revalidateMagazinePaths(id);
  return { success: true };
}

export async function unpublishMagazine(id: string) {
  await prisma.magazine.update({
    where: { id },
    data: { status: "unpublished" },
  });

  // RAG: 발행취소 시 색인에서 제거(함수가 비발행을 감지해 청크 삭제). best-effort.
  generateMagazineEmbeddings(id).catch((err) =>
    console.error("[RAG] Magazine embedding cleanup failed:", err)
  );

  revalidateMagazinePaths(id);
  return { success: true };
}

export async function deleteMagazine(id: string) {
  // Collect Storage-backed URLs before deletion. Cascade removes pages (NOT the
  // Storage objects), so gather them up front. 기사(Article)는 매거진 소유가 아니라
  // 독립 콘텐츠이므로 매거진 삭제 시 함께 지우지 않는다(페이지 연동만 해제됨).
  const magazine = await prisma.magazine.findUnique({
    where: { id },
    select: {
      coverImageUrl: true,
      pages: { select: { imageUrl: true } },
    },
  });

  if (!magazine) {
    return { error: "매거진을 찾을 수 없습니다" };
  }

  await prisma.magazine.delete({ where: { id } });

  // RAG: 삭제 시 매거진 청크 정리(ContentChunk는 FK 없음 → 명시 삭제). best-effort.
  await deleteContentChunks("magazine", id).catch((err) =>
    console.error("[RAG] Magazine chunk cleanup failed:", err)
  );

  const urls = new Set<string>();
  if (magazine.coverImageUrl) urls.add(magazine.coverImageUrl);
  for (const page of magazine.pages) if (page.imageUrl) urls.add(page.imageUrl);

  // Best-effort cleanup; failures are logged inside deleteUploadedFile and must
  // not block the deletion that already succeeded in the DB.
  await Promise.allSettled([...urls].map((url) => deleteUploadedFile(url)));

  revalidateMagazinePaths();
  redirect("/admin/magazines");
}

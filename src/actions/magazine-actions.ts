"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";
import { generateMagazineEmbeddings, deleteContentChunks } from "@/lib/rag";
import { isAdmin } from "@/lib/auth";

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
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
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
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
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

// 매거진 원문 텍스트 저장 — 이미지형처럼 페이지에 텍스트가 없는 매거진의 RAG 코퍼스.
// 본문의 `p.12` 마커로 구간을 나누면 청크가 그 페이지로 귀속된다(src/lib/magazine-source-text.ts).
const MAX_SOURCE_TEXT = 300_000; // 매거진당 원문 상한(≈30만 자)

export async function updateMagazineSourceText(id: string, sourceText: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  if (typeof sourceText !== "string")
    return { error: "텍스트가 올바르지 않습니다" };
  if (sourceText.length > MAX_SOURCE_TEXT)
    return { error: "텍스트가 너무 깁니다(최대 30만 자)" };

  const text = sourceText.trim();
  const magazine = await prisma.magazine.update({
    where: { id },
    data: {
      sourceText: text || null,
      sourceTextUpdatedAt: text ? new Date() : null,
    },
    select: { status: true },
  });

  // 발행본은 저장 즉시 재색인해야 "저장했는데 챗봇이 모른다"가 생기지 않는다.
  // 발행 전이면 색인 대상이 아니므로(비공개 유출 방지) 발행 시점에 색인된다.
  let indexed = false;
  if (magazine.status === "published") {
    try {
      await generateMagazineEmbeddings(id);
      indexed = true;
    } catch (err) {
      console.error("[RAG] Magazine sourceText embedding failed:", err);
      revalidateMagazinePaths(id);
      return {
        success: true as const,
        indexed: false,
        warning: "저장했지만 색인에 실패했습니다. 잠시 후 다시 저장해주세요.",
      };
    }
  }

  revalidateMagazinePaths(id);
  revalidatePath(`/magazines/${id}`);
  return { success: true as const, indexed };
}

export async function publishMagazine(id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
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
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  await prisma.magazine.update({
    where: { id },
    data: { status: "unpublished" },
  });

  // RAG: 미발행 시 색인 청크를 즉시 제거. 발행 색인은 임베딩 시간 때문에 fire-and-forget이지만,
  // 미발행은 '비공개 전환'이라 제거를 반드시 완료해야 한다(await) — 안 그러면 남은 청크가
  // searchChunks(발행여부 미필터)에 계속 잡혀 챗봇이 비공개 매거진 내용을 답한다.
  await deleteContentChunks("magazine", id).catch((err) =>
    console.error("[RAG] Magazine chunk cleanup failed:", err)
  );

  revalidateMagazinePaths(id);
  return { success: true };
}

export async function deleteMagazine(id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  // Collect Storage-backed URLs before deletion. Cascade removes pages (NOT the
  // Storage objects), so gather them up front. 기사(Article)는 매거진 소유가 아니라
  // 독립 콘텐츠이므로 매거진 삭제 시 함께 지우지 않는다(페이지 연동만 해제됨).
  const magazine = await prisma.magazine.findUnique({
    where: { id },
    select: {
      coverImageUrl: true,
      pages: { select: { imageUrl: true } },
      assets: { select: { url: true } }, // 미디어 라이브러리 — cascade는 DB만, Storage는 수동 정리
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
  for (const asset of magazine.assets) urls.add(asset.url); // 미디어 라이브러리 이미지도 Storage 정리

  // Best-effort cleanup; failures are logged inside deleteUploadedFile and must
  // not block the deletion that already succeeded in the DB.
  await Promise.allSettled([...urls].map((url) => deleteUploadedFile(url)));

  revalidateMagazinePaths();
  redirect("/admin/magazines");
}

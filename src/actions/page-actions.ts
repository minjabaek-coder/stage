"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import sanitizeHtml from "sanitize-html";
import { deleteUploadedFile } from "@/lib/upload";
import { getSupabase, STORAGE_BUCKET, getPublicUrl } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// 구성형 레이아웃 저장 전 텍스트 블록 HTML 정제(스타일은 블록 속성으로 관리).
function sanitizeLayout(layout: unknown): { blocks: unknown[]; pageBg?: string } {
  const obj = layout as { blocks?: unknown[]; pageBg?: unknown } | null;
  if (!obj || !Array.isArray(obj.blocks)) return { blocks: [] };
  const blocks = obj.blocks.map((b) => {
    const blk = b as { type?: string; html?: unknown };
    if (blk && blk.type === "text" && typeof blk.html === "string") {
      return {
        ...blk,
        html: sanitizeHtml(blk.html, {
          allowedTags: ["b", "strong", "i", "em", "u", "s", "br", "p", "div", "span", "a", "blockquote", "ul", "ol", "li", "h2", "h3", "small"],
          allowedAttributes: { a: ["href", "target", "rel"] },
        }),
      };
    }
    return b;
  });
  return { blocks, pageBg: typeof obj.pageBg === "string" ? obj.pageBg : undefined };
}

// 구성형(39호+) 빈 페이지 추가
export async function createComposedPage(magazineId: string) {
  const agg = await prisma.magazinePage.aggregate({
    where: { magazineId },
    _max: { sortOrder: true, pageNumber: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;
  const pageNumber = (agg._max.pageNumber ?? 0) + 1;
  const page = await prisma.magazinePage.create({
    data: {
      magazineId,
      kind: "composed",
      layout: { blocks: [] } as Prisma.InputJsonValue,
      sortOrder,
      pageNumber,
    },
  });
  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath(`/magazines/${magazineId}`);
  return { success: true as const, pageId: page.id };
}

// 구성형 페이지 레이아웃 저장(에디터). articleId 연동도 함께.
export async function updatePageLayout(
  pageId: string,
  magazineId: string,
  layout: unknown,
  articleId?: string | null
) {
  await prisma.magazinePage.update({
    where: { id: pageId },
    data: {
      layout: sanitizeLayout(layout) as Prisma.InputJsonValue,
      ...(articleId !== undefined
        ? { articleId: articleId || null }
        : {}),
    },
  });
  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath(`/magazines/${magazineId}`);
  return { success: true as const };
}

// 페이지 순서를 orderedIds 순으로 재배치.
// (magazineId, sortOrder) 유니크 제약을 피하는 2-pass를 **단 2개의 raw SQL**로 수행한다.
// (페이지별 update 110개를 한 트랜잭션에 넣으면 대륙간 DB 지연 시 Prisma 5s 트랜잭션
//  한도(P2028)를 초과해 실패함 — Vercel(미동부)↔Supabase(서울). 2 statement면 즉시 완료.)
async function applyPageOrder(orderedIds: string[]) {
  if (orderedIds.length === 0) return;
  const tuples = Prisma.join(
    orderedIds.map((id, i) => Prisma.sql`(${id}::text, ${i}::int)`)
  );
  await prisma.$transaction([
    // pass 1: 모두 음수로 이동(충돌 제거)
    prisma.$executeRaw`
      UPDATE "MagazinePage" AS m
      SET "sortOrder" = v.ord - 100000
      FROM (VALUES ${tuples}) AS v(id, ord)
      WHERE m.id = v.id
    `,
    // pass 2: 최종 sortOrder/pageNumber 설정
    prisma.$executeRaw`
      UPDATE "MagazinePage" AS m
      SET "sortOrder" = v.ord, "pageNumber" = v.ord + 1
      FROM (VALUES ${tuples}) AS v(id, ord)
      WHERE m.id = v.id
    `,
  ]);
}

export async function reorderPages(
  magazineId: string,
  orderedIds: string[]
) {
  await applyPageOrder(orderedIds);

  // Update cover image to first page
  const firstPage = await prisma.magazinePage.findFirst({
    where: { magazineId },
    orderBy: { sortOrder: "asc" },
  });

  // 이미지형만 커버를 첫 페이지 이미지로 동기화(구성형은 imageUrl이 없어 덮어쓰지 않음)
  if (firstPage?.imageUrl) {
    await prisma.magazine.update({
      where: { id: magazineId },
      data: { coverImageUrl: firstPage.imageUrl },
    });
  }

  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath("/");
  return { success: true };
}

export async function deletePage(pageId: string, magazineId: string) {
  const page = await prisma.magazinePage.findUnique({
    where: { id: pageId },
  });

  if (page) {
    if (page.imageUrl) await deleteUploadedFile(page.imageUrl);
    await prisma.magazinePage.delete({ where: { id: pageId } });

    // Reorder remaining pages (two-pass for unique constraint)
    const remaining = await prisma.magazinePage.findMany({
      where: { magazineId },
      orderBy: { sortOrder: "asc" },
    });

    if (remaining.length > 0) {
      await applyPageOrder(remaining.map((p) => p.id));
    }

    // Update cover
    const firstPage = remaining[0];
    await prisma.magazine.update({
      where: { id: magazineId },
      data: { coverImageUrl: firstPage?.imageUrl ?? null },
    });
  }

  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath("/");
  return { success: true };
}

function extractStoragePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`);
    if (parts.length < 2) return null;
    return decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
}

export async function renamePageFiles(magazineId: string) {
  const [pages, magazine] = await Promise.all([
    prisma.magazinePage.findMany({
      where: { magazineId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.magazine.findUnique({
      where: { id: magazineId },
      select: { coverImageUrl: true },
    }),
  ]);

  let renamed = 0;
  // The cover points at one page's original URL; capture its new URL and apply
  // a single update after the loop instead of re-querying the magazine per page.
  let newCoverUrl: string | null = null;

  for (const page of pages) {
    const oldPath = extractStoragePath(page.imageUrl ?? "");
    if (!oldPath) continue;

    const ext = oldPath.split(".").pop() || "webp";
    const newFilename = `${page.pageNumber}.${ext}`;
    const newPath = `magazines/${magazineId}/pages/${newFilename}`;

    if (oldPath === newPath) continue;

    const { error } = await getSupabase().storage
      .from(STORAGE_BUCKET)
      .move(oldPath, newPath);

    if (error) {
      console.error(`Failed to rename ${oldPath} → ${newPath}:`, error.message);
      continue;
    }

    const newUrl = getPublicUrl(newPath);
    await prisma.magazinePage.update({
      where: { id: page.id },
      data: { imageUrl: newUrl },
    });

    if (magazine?.coverImageUrl === page.imageUrl) {
      newCoverUrl = newUrl;
    }

    renamed++;
  }

  if (newCoverUrl) {
    await prisma.magazine.update({
      where: { id: magazineId },
      data: { coverImageUrl: newCoverUrl },
    });
  }

  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath("/");
  return { success: true, renamed };
}

export async function renamePageFile(
  pageId: string,
  magazineId: string,
  newName: string
) {
  const page = await prisma.magazinePage.findUnique({ where: { id: pageId } });
  if (!page) return { error: "페이지를 찾을 수 없습니다" };

  const oldPath = extractStoragePath(page.imageUrl ?? "");
  if (!oldPath) return { error: "파일 경로를 찾을 수 없습니다" };

  const ext = oldPath.split(".").pop() || "webp";
  const safeName = newName.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
  const newFilename = `${safeName}.${ext}`;
  const newPath = `magazines/${magazineId}/pages/${newFilename}`;

  if (oldPath === newPath) return { success: true };

  const { error } = await getSupabase().storage
    .from(STORAGE_BUCKET)
    .move(oldPath, newPath);

  if (error) return { error: `파일명 변경 실패: ${error.message}` };

  const newUrl = getPublicUrl(newPath);
  await prisma.magazinePage.update({
    where: { id: pageId },
    data: { imageUrl: newUrl },
  });

  const magazine = await prisma.magazine.findUnique({ where: { id: magazineId } });
  if (magazine?.coverImageUrl === page.imageUrl) {
    await prisma.magazine.update({
      where: { id: magazineId },
      data: { coverImageUrl: newUrl },
    });
  }

  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  return { success: true };
}

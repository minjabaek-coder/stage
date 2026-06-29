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
  // 색/그라데이션 문자열만 허용(CSS 주입 차단). 위험 토큰 포함 시 제거.
  const safeColor = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    if (/[<>]|url\(|expression|javascript:/i.test(v)) return undefined;
    return v.slice(0, 200);
  };
  const blocks = obj.blocks.map((b) => {
    const blk = b as { type?: string; html?: unknown; fill?: unknown; stroke?: unknown };
    if (blk && blk.type === "text" && typeof blk.html === "string") {
      return {
        ...blk,
        html: sanitizeHtml(blk.html, {
          allowedTags: ["b", "strong", "i", "em", "u", "s", "br", "p", "div", "span", "a", "blockquote", "ul", "ol", "li", "h2", "h3", "small"],
          allowedAttributes: { a: ["href", "target", "rel"] },
        }),
      };
    }
    if (blk && blk.type === "shape") {
      return { ...blk, fill: safeColor(blk.fill), stroke: safeColor(blk.stroke) };
    }
    return b;
  });
  return { blocks, pageBg: typeof obj.pageBg === "string" ? obj.pageBg : undefined };
}

function genBlockId() {
  return "b" + Math.random().toString(36).slice(2, 9);
}
// layout의 모든 블록 id를 새로 발급(복제 시 원본과 id 충돌 방지 — dnd-kit/React key/patch 안정성)
function regenBlockIds(layout: unknown): Prisma.InputJsonValue {
  const obj = layout as { blocks?: Array<Record<string, unknown>>; pageBg?: string } | null;
  if (!obj || !Array.isArray(obj.blocks)) return { blocks: [] };
  const blocks = obj.blocks.map((b) => ({ ...b, id: genBlockId() }));
  return { blocks, ...(typeof obj.pageBg === "string" ? { pageBg: obj.pageBg } : {}) } as Prisma.InputJsonValue;
}

// 새 페이지(orderedIds 기준)에서 newId를 afterId 바로 다음에 배치하도록 재정렬
async function placeAfter(magazineId: string, newId: string, afterId?: string) {
  if (!afterId) return;
  const pages = await prisma.magazinePage.findMany({
    where: { magazineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const ids = pages.map((p) => p.id).filter((id) => id !== newId);
  const idx = ids.indexOf(afterId);
  if (idx >= 0) ids.splice(idx + 1, 0, newId);
  else ids.push(newId);
  await applyPageOrder(ids);
}

// 구성형(39호+) 빈 페이지 추가. afterPageId 지정 시 그 페이지 '다음'에 삽입(D5).
export async function createComposedPage(
  magazineId: string,
  opts?: { afterPageId?: string }
) {
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
  await placeAfter(magazineId, page.id, opts?.afterPageId);
  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath(`/magazines/${magazineId}`);
  return { success: true as const, pageId: page.id };
}

// 페이지 복제 — layout 깊은 복사 + 블록 id 재생성, 원본 다음에 삽입. articleId는 비움(딥링크 중복 방지).
export async function duplicatePage(pageId: string) {
  const src = await prisma.magazinePage.findUnique({
    where: { id: pageId },
    select: { magazineId: true, kind: true, layout: true },
  });
  if (!src) return { error: "페이지를 찾을 수 없습니다" as const };
  const agg = await prisma.magazinePage.aggregate({
    where: { magazineId: src.magazineId },
    _max: { sortOrder: true, pageNumber: true },
  });
  const copy = await prisma.magazinePage.create({
    data: {
      magazineId: src.magazineId,
      kind: src.kind,
      layout: regenBlockIds(src.layout),
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
      pageNumber: (agg._max.pageNumber ?? 0) + 1,
      articleId: null,
    },
  });
  await placeAfter(src.magazineId, copy.id, pageId);
  revalidatePath(`/admin/magazines/${src.magazineId}/edit`);
  revalidatePath(`/magazines/${src.magazineId}`);
  return { success: true as const, pageId: copy.id };
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

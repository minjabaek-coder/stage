"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { deleteUploadedFile } from "@/lib/upload";
import { getSupabase, STORAGE_BUCKET, getPublicUrl } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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
      layout: (layout ?? { blocks: [] }) as Prisma.InputJsonValue,
      ...(articleId !== undefined
        ? { articleId: articleId || null }
        : {}),
    },
  });
  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath(`/magazines/${magazineId}`);
  return { success: true as const };
}

export async function reorderPages(
  magazineId: string,
  orderedIds: string[]
) {
  // Two-pass to avoid unique constraint on (magazineId, sortOrder):
  // 1. Set all sortOrders to negative (offset) values to clear conflicts
  // 2. Set final sortOrders
  const offset = 100000;

  await prisma.$transaction([
    ...orderedIds.map((id, index) =>
      prisma.magazinePage.update({
        where: { id },
        data: { sortOrder: -(index + offset) },
      })
    ),
    ...orderedIds.map((id, index) =>
      prisma.magazinePage.update({
        where: { id },
        data: {
          sortOrder: index,
          pageNumber: index + 1,
        },
      })
    ),
  ]);

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
      const offset = 100000;
      await prisma.$transaction([
        ...remaining.map((p, index) =>
          prisma.magazinePage.update({
            where: { id: p.id },
            data: { sortOrder: -(index + offset) },
          })
        ),
        ...remaining.map((p, index) =>
          prisma.magazinePage.update({
            where: { id: p.id },
            data: { sortOrder: index, pageNumber: index + 1 },
          })
        ),
      ]);
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

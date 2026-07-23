"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { deleteUploadedFile } from "@/lib/upload";
import { parseHtmlLayout, parsePageLayout } from "@/types/magazine-layout";
import { revalidatePath } from "next/cache";

// 이 매거진에서 asset.url을 참조하는 페이지 번호 목록(HTML 페이지 본문 + 구성형 이미지 블록).
async function findAssetUsage(magazineId: string, url: string): Promise<number[]> {
  const pages = await prisma.magazinePage.findMany({
    where: { magazineId },
    orderBy: { sortOrder: "asc" },
    select: { pageNumber: true, kind: true, layout: true },
  });
  const used: number[] = [];
  for (const p of pages) {
    if (p.kind === "html") {
      const html = parseHtmlLayout(p.layout)?.html ?? "";
      if (html.includes(url)) used.push(p.pageNumber);
    } else if (p.kind === "composed") {
      const layout = parsePageLayout(p.layout);
      if (layout?.blocks.some((b) => b.type === "image" && b.src === url)) used.push(p.pageNumber);
    }
  }
  return used;
}

// 미디어 라이브러리 이미지 삭제. 사용 중이면 기본 차단하고 사용처를 반환(UI 경고).
// force=true면 사용 중이어도 Storage+DB에서 삭제(참조 페이지는 이미지가 깨짐).
export async function deleteMagazineAsset(
  assetId: string,
  opts?: { force?: boolean }
) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" as const };
  const asset = await prisma.magazineAsset.findUnique({ where: { id: assetId } });
  if (!asset) return { error: "이미지를 찾을 수 없습니다" as const };

  const usedIn = await findAssetUsage(asset.magazineId, asset.url);
  if (usedIn.length > 0 && !opts?.force) {
    return { inUse: usedIn };
  }

  await deleteUploadedFile(asset.url);
  await prisma.magazineAsset.delete({ where: { id: assetId } });
  revalidatePath(`/admin/magazines/${asset.magazineId}/edit`);
  return { success: true as const };
}

// 편집기가 필요 시 갱신 로드하는 목록(초기 목록은 edit 페이지의 include로 전달).
export async function listMagazineAssets(magazineId: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" as const };
  const assets = await prisma.magazineAsset.findMany({
    where: { magazineId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, path: true, filename: true, createdAt: true },
  });
  return {
    success: true as const,
    assets: assets.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

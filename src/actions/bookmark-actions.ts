"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 기사 북마크 토글. 로그인 필요. 반환: 토글 후 북마크 여부 또는 에러.
export async function toggleBookmark(
  articleId: string,
): Promise<{ bookmarked: boolean } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const existing = await prisma.bookmark.findUnique({
    where: { userId_articleId: { userId: user.id, articleId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    revalidatePath("/mypage");
    return { bookmarked: false };
  }

  await prisma.bookmark.create({ data: { userId: user.id, articleId } });
  revalidatePath("/mypage");
  return { bookmarked: true };
}

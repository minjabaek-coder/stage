"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { isAdmin } from "@/lib/auth";

const tocEntrySchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  pageNumber: z.coerce.number().int().positive("페이지 번호는 양수여야 합니다"),
});

const saveTocSchema = z.object({
  magazineId: z.string().min(1),
  entries: z.array(tocEntrySchema),
});

export async function saveTocEntries(
  magazineId: string,
  entries: { title: string; pageNumber: number }[]
) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const parsed = saveTocSchema.safeParse({ magazineId, entries });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const sorted = [...parsed.data.entries].sort(
    (a, b) => a.pageNumber - b.pageNumber
  );

  await prisma.$transaction([
    prisma.magazineTocEntry.deleteMany({
      where: { magazineId: parsed.data.magazineId },
    }),
    ...sorted.map((entry, index) =>
      prisma.magazineTocEntry.create({
        data: {
          magazineId: parsed.data.magazineId,
          title: entry.title,
          pageNumber: entry.pageNumber,
          sortOrder: index,
        },
      })
    ),
  ]);

  revalidatePath(`/admin/magazines/${magazineId}/edit`);
  revalidatePath(`/magazines/${magazineId}`);
  return { success: true };
}

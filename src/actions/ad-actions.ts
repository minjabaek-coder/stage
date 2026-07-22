"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";
import { AD_PLACEMENT_VALUES } from "@/lib/ad-placements";
import { isAdmin } from "@/lib/auth";

const adSchema = z.object({
  sponsor: z.string().min(1, "스폰서를 입력해주세요").max(120),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  description: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  linkUrl: z.string().url("올바른 링크 URL을 입력해주세요"),
  type: z.string().default("배너"),
  placement: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
});

function readForm(formData: FormData) {
  const s = (k: string) => (formData.get(k) ?? "").toString();
  return adSchema.safeParse({
    sponsor: s("sponsor"),
    title: s("title"),
    description: s("description"),
    imageUrl: s("imageUrl"),
    linkUrl: s("linkUrl"),
    type: s("type") || "배너",
    placement: formData
      .getAll("placement")
      .map(String)
      .filter((p) => AD_PLACEMENT_VALUES.includes(p)),
    isActive: formData.get("isActive") === "on",
    startDate: s("startDate"),
    endDate: s("endDate"),
  });
}

function toData(d: z.infer<typeof adSchema>) {
  return {
    sponsor: d.sponsor,
    title: d.title,
    description: d.description || null,
    imageUrl: d.imageUrl || null,
    linkUrl: d.linkUrl,
    type: d.type || "배너",
    placement: d.placement,
    isActive: d.isActive,
    startDate: d.startDate ? new Date(d.startDate) : null,
    endDate: d.endDate ? new Date(d.endDate) : null,
  };
}

export async function createAd(formData: FormData) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ad = await prisma.advertisement.create({ data: toData(parsed.data) });
  redirect(`/admin/ads/${ad.id}/edit`);
}

export async function updateAd(id: string, formData: FormData) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const current = await prisma.advertisement.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  const data = toData(parsed.data);
  await prisma.advertisement.update({ where: { id }, data });

  if (current?.imageUrl && current.imageUrl !== data.imageUrl) {
    await deleteUploadedFile(current.imageUrl);
  }

  revalidatePath("/admin/ads");
  revalidatePath(`/admin/ads/${id}/edit`);
  redirect("/admin/ads");
}

export async function toggleAdActive(id: string, isActive: boolean) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  await prisma.advertisement.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/ads");
  return { success: true };
}

export async function deleteAd(id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const ad = await prisma.advertisement.findUnique({ where: { id } });
  if (!ad) return { error: "광고를 찾을 수 없습니다" };

  await prisma.advertisement.delete({ where: { id } });
  if (ad.imageUrl) await deleteUploadedFile(ad.imageUrl);

  revalidatePath("/admin/ads");
  return { success: true };
}

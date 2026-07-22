"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { deleteUploadedFile } from "@/lib/upload";
import { generateCultureEventEmbeddings, deleteContentChunks } from "@/lib/rag";
import { isAdmin } from "@/lib/auth";

function parseList(v: string): string[] {
  return v
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function revalidate(id?: string, slug?: string) {
  if (id) revalidatePath(`/admin/culture-events/${id}/edit`);
  if (slug) revalidatePath(`/culture-events/${slug}`);
  revalidatePath("/admin/culture-events");
  revalidatePath("/culture-events");
  revalidatePath("/");
}

const schema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 사용 가능합니다"),
  type: z.string().default("공연"),
  genre: z.string().optional().default(""),
  venue: z.string().optional().default(""),
  address: z.string().optional().default(""),
  artists: z.string().optional().default(""),
  description: z.string().optional().default(""),
  thumbnailUrl: z.string().optional().default(""),
  startDate: z.string().min(1, "시작일을 입력해주세요"),
  endDate: z.string().optional().default(""),
  ticketUrl: z.string().optional().default(""),
  ticketPrice: z.string().optional().default(""),
  memberDiscount: z.coerce.number().int().min(0).max(100).default(0),
  eduInstructor: z.string().optional().default(""),
  eduSchedule: z.string().optional().default(""),
  maxParticipants: z.string().optional().default(""),
  applyUrl: z.string().optional().default(""),
  isFeatured: z.boolean().optional().default(false),
  sidebarFeatured: z.boolean().optional().default(false),
  publishedAt: z.string().optional().default(""),
});

function readForm(formData: FormData) {
  // 타입별로 일부 필드(교육/티켓)는 DOM에 없어 null이 온다 → "" 로 보정
  const s = (k: string) => (formData.get(k) ?? "").toString();
  return schema.safeParse({
    title: s("title"),
    slug: s("slug"),
    type: s("type") || "공연",
    genre: s("genre"),
    venue: s("venue"),
    address: s("address"),
    artists: s("artists"),
    description: s("description"),
    thumbnailUrl: s("thumbnailUrl"),
    startDate: s("startDate"),
    endDate: s("endDate"),
    ticketUrl: s("ticketUrl"),
    ticketPrice: s("ticketPrice"),
    memberDiscount: s("memberDiscount") || 0,
    eduInstructor: s("eduInstructor"),
    eduSchedule: s("eduSchedule"),
    maxParticipants: s("maxParticipants"),
    applyUrl: s("applyUrl"),
    isFeatured: formData.get("isFeatured") === "on",
    sidebarFeatured: formData.get("sidebarFeatured") === "on",
    publishedAt: s("publishedAt"),
  });
}

function toData(d: z.infer<typeof schema>) {
  return {
    title: d.title,
    slug: d.slug,
    type: d.type || "공연",
    genre: parseList(d.genre),
    venue: d.venue || "",
    address: d.address || null,
    artists: parseList(d.artists),
    description: d.description || null,
    thumbnailUrl: d.thumbnailUrl || null,
    startDate: new Date(d.startDate),
    endDate: d.endDate ? new Date(d.endDate) : null,
    ticketUrl: d.ticketUrl || null,
    ticketPrice: d.ticketPrice || null,
    memberDiscount: d.memberDiscount,
    eduInstructor: d.eduInstructor || null,
    eduSchedule: d.eduSchedule || null,
    maxParticipants: d.maxParticipants ? parseInt(d.maxParticipants, 10) : null,
    applyUrl: d.applyUrl || null,
    isFeatured: d.isFeatured,
    sidebarFeatured: d.sidebarFeatured,
    publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
  };
}

export async function createCultureEvent(formData: FormData) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.cultureEvent.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const event = await prisma.cultureEvent.create({ data: toData(parsed.data) });
  redirect(`/admin/culture-events/${event.id}/edit`);
}

export async function updateCultureEvent(id: string, formData: FormData) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const conflict = await prisma.cultureEvent.findFirst({
    where: { slug: parsed.data.slug, NOT: { id } },
  });
  if (conflict) {
    return { error: `슬러그 "${parsed.data.slug}"은(는) 이미 존재합니다` };
  }

  const current = await prisma.cultureEvent.findUnique({
    where: { id },
    select: { thumbnailUrl: true },
  });

  const data = toData(parsed.data);
  await prisma.cultureEvent.update({ where: { id }, data });

  if (current?.thumbnailUrl && current.thumbnailUrl !== data.thumbnailUrl) {
    await deleteUploadedFile(current.thumbnailUrl);
  }

  // RAG: 수정 반영 — 발행 상태면 재색인, 아니면 청크 정리(함수가 자격 판단).
  generateCultureEventEmbeddings(id).catch((err) =>
    console.error("[RAG] CultureEvent re-embedding failed:", err)
  );

  revalidate(id, parsed.data.slug);
  redirect("/admin/culture-events");
}

export async function publishCultureEvent(id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const event = await prisma.cultureEvent.findUnique({ where: { id } });
  if (!event) return { error: "이벤트를 찾을 수 없습니다" };
  if (!event.title) return { error: "제목이 필요합니다" };

  await prisma.cultureEvent.update({
    where: { id },
    data: { status: "published", publishedAt: event.publishedAt ?? new Date() },
  });

  // RAG: 발행 시 이벤트 색인(서술형 질의 대응). best-effort.
  generateCultureEventEmbeddings(id).catch((err) =>
    console.error("[RAG] CultureEvent embedding failed:", err)
  );

  revalidate(id, event.slug);
  return { success: true };
}

export async function unpublishCultureEvent(id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const event = await prisma.cultureEvent.findUnique({ where: { id } });
  if (!event) return { error: "이벤트를 찾을 수 없습니다" };

  await prisma.cultureEvent.update({
    where: { id },
    data: { status: "draft" },
  });

  // RAG: 발행취소 시 색인 제거. best-effort.
  generateCultureEventEmbeddings(id).catch((err) =>
    console.error("[RAG] CultureEvent embedding cleanup failed:", err)
  );

  revalidate(id, event.slug);
  return { success: true };
}

export async function deleteCultureEvent(id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const event = await prisma.cultureEvent.findUnique({ where: { id } });
  if (!event) return { error: "이벤트를 찾을 수 없습니다" };

  await prisma.cultureEvent.delete({ where: { id } });

  // RAG: 삭제 시 청크 정리. best-effort.
  await deleteContentChunks("culture", id).catch((err) =>
    console.error("[RAG] CultureEvent chunk cleanup failed:", err)
  );

  if (event.thumbnailUrl) await deleteUploadedFile(event.thumbnailUrl);

  revalidate(undefined, event.slug);
  redirect("/admin/culture-events");
}

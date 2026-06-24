"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { generateEditToken, hashEditToken } from "@/lib/article-token";

const DEFAULT_TTL_DAYS = 30; // #5: 기본 30일, 관리자가 변경 가능

function parseTags(tags: string): string[] {
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

// ── 관리자: 토큰 발급/재발급 ── (기존 토큰 있으면 교체)
export async function issueArticleToken(
  articleId: string,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<{ error?: string; token?: string }> {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const { token, hash } = generateEditToken();
  const expiresAt =
    ttlDays > 0 ? new Date(Date.now() + ttlDays * 86_400_000) : null;
  await prisma.articleEditToken.upsert({
    where: { articleId },
    create: { articleId, tokenHash: hash, expiresAt },
    update: { tokenHash: hash, expiresAt, revokedAt: null, createdAt: new Date() },
  });
  revalidatePath(`/admin/articles/${articleId}/edit`);
  return { token }; // 평문은 이 응답에서 1회만
}

// ── 관리자: 토큰 회수 ──
export async function revokeArticleToken(articleId: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  await prisma.articleEditToken.updateMany({
    where: { articleId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/admin/articles/${articleId}/edit`);
  return { success: true };
}

// ── 관리자: 만료 기간 변경 ──
export async function setArticleTokenExpiry(articleId: string, ttlDays: number) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const expiresAt =
    ttlDays > 0 ? new Date(Date.now() + ttlDays * 86_400_000) : null;
  await prisma.articleEditToken.update({
    where: { articleId },
    data: { expiresAt },
  });
  revalidatePath(`/admin/articles/${articleId}/edit`);
  return { success: true };
}

// ── 토큰 검증(공개) — /contribute에서 사용 ──
export type TokenResolution =
  | { ok: true; article: { id: string; title: string; slug: string; excerpt: string | null; content: string; thumbnailUrl: string | null; tags: string[]; status: string } }
  | { ok: false; reason: "invalid" | "revoked" | "expired" | "published"; slug?: string; magazineLink?: boolean };

export async function resolveEditToken(token: string): Promise<TokenResolution> {
  const hash = hashEditToken(token);
  const rec = await prisma.articleEditToken.findUnique({
    where: { tokenHash: hash },
    include: {
      article: {
        select: {
          id: true, title: true, slug: true, excerpt: true, content: true,
          thumbnailUrl: true, tags: true, status: true,
        },
      },
    },
  });
  if (!rec || !rec.article) return { ok: false, reason: "invalid" };
  // 발행을 최우선 — 발행 시 토큰이 자동 회수되므로, published 안내가 revoked보다 우선.
  if (rec.article.status === "published")
    return { ok: false, reason: "published", slug: rec.article.slug };
  if (rec.revokedAt) return { ok: false, reason: "revoked" };
  if (rec.expiresAt && rec.expiresAt < new Date())
    return { ok: false, reason: "expired" };
  return { ok: true, article: rec.article };
}

// ── 기고자: 저장/제출(intent로 분기) — 제한 필드(원고)만 ──
// intent="save" → 저장만 / "submit" → 저장 + status=submitted(검토대기)
export async function contributeAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean; submitted?: boolean; status?: string }> {
  const token = (formData.get("token") ?? "").toString();
  const intent = (formData.get("intent") ?? "save").toString();
  const res = await resolveEditToken(token);
  if (!res.ok) return { error: "편집할 수 없는 링크입니다 (만료·회수·발행됨)" };

  const title = (formData.get("title") ?? "").toString().trim();
  if (!title) return { error: "제목을 입력해주세요" };

  const updated = await prisma.article.update({
    where: { id: res.article.id },
    data: {
      title: title.slice(0, 200),
      content: (formData.get("content") ?? "").toString(),
      excerpt: (formData.get("excerpt") ?? "").toString() || null,
      thumbnailUrl: (formData.get("thumbnailUrl") ?? "").toString() || null,
      tags: parseTags((formData.get("tags") ?? "").toString()),
      ...(intent === "submit" ? { status: "submitted" as const } : {}),
    },
    select: { status: true },
  });
  if (intent === "submit") revalidatePath("/admin/articles");
  return { success: true, submitted: intent === "submit", status: updated.status };
}

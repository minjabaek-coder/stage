"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import {
  getStageOsBanner,
  setStageOsBanner,
  type StageOsBannerConfig,
} from "@/lib/site-settings";

// 공개 읽기 — StageOS 배너(클라이언트)가 마운트 시 호출
export async function getStageOsBannerPublic(): Promise<StageOsBannerConfig> {
  return getStageOsBanner();
}

const schema = z.object({
  enabled: z.boolean(),
  eyebrow: z.string().trim().max(80, "라벨은 80자 이하로 입력해주세요"),
  headline: z
    .string()
    .trim()
    .min(1, "헤드라인을 입력해주세요")
    .max(200, "헤드라인은 200자 이하로 입력해주세요"),
  ctaLabel: z.string().trim().max(40, "버튼 문구는 40자 이하로 입력해주세요"),
  ctaHref: z
    .string()
    .trim()
    .min(1, "버튼 링크를 입력해주세요")
    .max(300, "링크가 너무 깁니다"),
});

export async function saveStageOsBanner(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  if (!(await isAdmin())) return { error: "권한이 없습니다" };
  const parsed = schema.safeParse({
    enabled: formData.get("enabled") === "on",
    eyebrow: (formData.get("eyebrow") ?? "").toString(),
    headline: (formData.get("headline") ?? "").toString(),
    ctaLabel: (formData.get("ctaLabel") ?? "").toString(),
    ctaHref: (formData.get("ctaHref") ?? "").toString(),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };

  await setStageOsBanner(parsed.data);
  revalidatePath("/admin/settings");
  return { success: true };
}

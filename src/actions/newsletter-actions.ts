"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const ALLOWED_SOURCES = ["home", "footer", "pro-waitlist", "sidebar"];

const schema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
});

export async function subscribeNewsletter(_prev: unknown, formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const rawSource = (formData.get("source") ?? "home").toString();
  const source = ALLOWED_SOURCES.includes(rawSource) ? rawSource : "home";

  try {
    await prisma.newsletterSubscriber.create({
      data: { email: parsed.data.email, source },
    });
    return { success: true };
  } catch (e) {
    // Unique 위반(P2002) = 이미 구독한 이메일
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return { error: "이미 구독 중인 이메일입니다." };
    }
    console.error("[newsletter] subscribe failed:", e);
    return { error: "구독 처리 중 오류가 발생했습니다." };
  }
}

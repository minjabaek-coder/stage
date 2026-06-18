"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().max(40, "이름은 40자 이내로 입력해주세요"),
  interests: z.array(z.string()).max(20),
  newsletterOptIn: z.boolean(),
  eventAlertOptIn: z.boolean(),
});

export async function updateProfile(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const parsed = schema.safeParse({
    name: (formData.get("name") ?? "").toString().trim(),
    interests: formData.getAll("interests").map(String),
    newsletterOptIn: formData.get("newsletterOptIn") === "on",
    eventAlertOptIn: formData.get("eventAlertOptIn") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      interests: parsed.data.interests,
      newsletterOptIn: parsed.data.newsletterOptIn,
      eventAlertOptIn: parsed.data.eventAlertOptIn,
    },
  });

  revalidatePath("/mypage");
  return { success: true };
}

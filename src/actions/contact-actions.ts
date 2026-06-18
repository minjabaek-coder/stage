"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const contactSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(80),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  company: z.string().max(120).optional().default(""),
  type: z.string().default("일반"),
  message: z.string().min(5, "문의 내용을 5자 이상 입력해주세요").max(5000),
});

// 공개 문의 폼 제출
export async function submitContact(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = contactSchema.safeParse({
    name: (formData.get("name") ?? "").toString(),
    email: (formData.get("email") ?? "").toString(),
    company: (formData.get("company") ?? "").toString(),
    type: (formData.get("type") ?? "일반").toString(),
    message: (formData.get("message") ?? "").toString(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.contact.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company || null,
      type: parsed.data.type || "일반",
      message: parsed.data.message,
    },
  });

  return { success: true };
}

// 어드민: 처리 상태 변경
export async function setContactStatus(id: string, status: "new" | "done") {
  await prisma.contact.update({ where: { id }, data: { status } });
  revalidatePath("/admin/contacts");
  return { success: true };
}

// 어드민: 삭제
export async function deleteContact(id: string) {
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/admin/contacts");
  return { success: true };
}

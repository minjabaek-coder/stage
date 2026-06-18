"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const tipSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(80),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  phone: z.string().max(40).optional().default(""),
  category: z.string().default("일반"),
  title: z.string().min(1, "제목을 입력해주세요").max(200),
  content: z.string().min(10, "제보 내용을 10자 이상 입력해주세요").max(8000),
});

// 공개 제보 폼 제출
export async function submitTip(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = tipSchema.safeParse({
    name: (formData.get("name") ?? "").toString(),
    email: (formData.get("email") ?? "").toString(),
    phone: (formData.get("phone") ?? "").toString(),
    category: (formData.get("category") ?? "일반").toString(),
    title: (formData.get("title") ?? "").toString(),
    content: (formData.get("content") ?? "").toString(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.tip.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      category: parsed.data.category || "일반",
      title: parsed.data.title,
      content: parsed.data.content,
    },
  });

  return { success: true };
}

// 어드민: 처리 상태 변경
export async function setTipStatus(id: string, status: "new" | "done") {
  await prisma.tip.update({ where: { id }, data: { status } });
  revalidatePath("/admin/tips");
  return { success: true };
}

// 어드민: 삭제
export async function deleteTip(id: string) {
  await prisma.tip.delete({ where: { id } });
  revalidatePath("/admin/tips");
  return { success: true };
}

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

// 통합 문의 폼 — 유형에 따라 Contact(일반·광고·제휴 등) 또는 Tip(기사 제보)으로 저장.
// 유형별 추가 필드: 회사/기관명(company)·연락처(phone)·세부(detail).
const inquirySchema = z.object({
  type: z.string().default("일반"),
  name: z.string().min(1, "이름을 입력해주세요").max(80),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  company: z.string().max(120).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  detail: z.string().max(120).optional().default(""),
  title: z.string().max(200).optional().default(""),
  message: z.string().min(5, "내용을 5자 이상 입력해주세요").max(8000),
});

// 유형별 세부 항목의 라벨(메시지 구조화·어드민 가독성용)
const DETAIL_LABEL: Record<string, string> = {
  광고: "광고 희망 영역",
  제휴: "제휴 분야",
  "StageOS 도입": "기관 유형",
};

export async function submitInquiry(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = inquirySchema.safeParse({
    type: (formData.get("type") ?? "일반").toString(),
    name: (formData.get("name") ?? "").toString(),
    email: (formData.get("email") ?? "").toString(),
    company: (formData.get("company") ?? "").toString(),
    phone: (formData.get("phone") ?? "").toString(),
    detail: (formData.get("detail") ?? "").toString(),
    title: (formData.get("title") ?? "").toString(),
    message: (formData.get("message") ?? "").toString(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { type, name, email, company, phone, detail, title, message } =
    parsed.data;

  if (type === "기사 제보") {
    if (!title) return { error: "제보 제목을 입력해주세요" };
    await prisma.tip.create({
      data: {
        name,
        email,
        phone: phone || null,
        category: detail || "제보",
        title,
        content: message,
      },
    });
  } else {
    // Contact엔 phone·detail 컬럼이 없어 메시지에 구조화해 보존
    const lines: string[] = [];
    if (detail) lines.push(`[${DETAIL_LABEL[type] ?? "세부"}] ${detail}`);
    if (phone) lines.push(`[연락처] ${phone}`);
    lines.push(message);
    await prisma.contact.create({
      data: {
        name,
        email,
        company: company || null,
        type,
        message: lines.join("\n"),
      },
    });
  }
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

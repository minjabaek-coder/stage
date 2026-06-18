import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 광고 노출: impressions 증가 (AdSlot 마운트 시 클라이언트 비콘이 호출)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.advertisement
    .update({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}

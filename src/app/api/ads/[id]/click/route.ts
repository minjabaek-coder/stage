import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 광고 클릭: clicks 증가 후 광고의 linkUrl로 리다이렉트.
// linkUrl은 관리자가 등록한 값(사용자 입력 아님)이라 오픈 리다이렉트 위험 없음.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ad = await prisma.advertisement.findUnique({
    where: { id },
    select: { linkUrl: true },
  });

  if (!ad) return NextResponse.redirect(new URL("/", req.url));

  await prisma.advertisement
    .update({ where: { id }, data: { clicks: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.redirect(ad.linkUrl, 302);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AD_CLICK_DAILY_LIMIT, clientIpFrom, hitLimit } from "@/lib/rate-limit";

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

  // 클릭 집계도 광고주 보고 수치다 → 같은 IP·같은 광고 일일 상한.
  // 넘어도 **리다이렉트는 정상 수행한다** — 이용자 이동을 막을 이유가 없다.
  const { exceeded } = await hitLimit(
    `adclick:${id}`,
    clientIpFrom(req.headers),
    AD_CLICK_DAILY_LIMIT,
  );
  if (!exceeded) {
    await prisma.advertisement
      .update({ where: { id }, data: { clicks: { increment: 1 } } })
      .catch(() => {});
  }

  return NextResponse.redirect(ad.linkUrl, 302);
}

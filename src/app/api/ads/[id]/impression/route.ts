import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AD_IMPRESSION_DAILY_LIMIT,
  clientIpFrom,
  hitLimit,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// 광고 노출: impressions 증가 (AdSlot 마운트 시 클라이언트 비콘이 호출)
//
// 인증 없는 공개 엔드포인트라 스크립트 반복 호출로 집계를 부풀릴 수 있었다.
// 광고 집계는 **광고주에게 보고되는 수치**라 무결성이 중요하다.
// 다만 조회수와 달리 정상 재방문도 노출로 세야 하므로, 하루 한 번이 아니라
// 같은 IP·같은 광고 기준 **일일 상한**을 둔다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { exceeded } = await hitLimit(
    `adimp:${id}`,
    clientIpFrom(req.headers),
    AD_IMPRESSION_DAILY_LIMIT,
  );
  // 넘으면 조용히 세지 않는다(판정 결과를 노출하지 않는다).
  if (exceeded) return NextResponse.json({ ok: true });

  await prisma.advertisement
    .update({ where: { id }, data: { impressions: { increment: 1 } } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}

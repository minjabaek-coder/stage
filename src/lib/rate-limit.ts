import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

// 게스트 AI 질문 한도의 **서버 측 축** (roadmap S0-2 / BL-10).
//
// 왜 필요한가: 기존 한도는 클라이언트가 보내는 sessionId(localStorage UUID) 하나로만
// 셌다. 지우거나 시크릿창을 열면 그냥 초기화된다 → 유료 API 비용이 무제한 노출.
//
// 개인정보 최소화 (docs/decisions 0009):
//  · IP 원본은 **저장·로깅하지 않는다**. HMAC 해시만 쓴다.
//  · 해시 솔트를 **날짜마다 교체**한다 → 어제 해시와 오늘 해시를 서로 연결할 수 없다.
//    한도가 어차피 '일일'이라 기능 손실이 없다.
//  · 카운터를 **대화 내용(AiInteraction)과 분리된 전용 테이블**에 둔다. 남는 건
//    "어떤 익명 버킷이 오늘 몇 번" 이라는 숫자뿐이고 질문·답변과 연결되지 않는다.
//  · 지난 날짜 버킷은 기록할 때 함께 지운다 → 보유기간이 구조적으로 '당일'.
//
// ⚠️ 이건 보안 경계가 아니라 **비용 가드**다. 헤더는 원리적으로 위조 가능하다
//    (Vercel이 오리진을 직접 노출하지 않아 실제 난이도는 높다).

/** 세션(클라이언트 축) 일일 한도 — 정상 이용자가 체감하는 값. */
export const SESSION_DAILY_LIMIT = 5;
/** IP(서버 축) 일일 천장 — 우회해도 넘을 수 없는 값.
 *  이동통신 CGNAT·사무실 NAT 뒤에서 여러 명이 한 IP를 공유하므로 넉넉히 잡는다. */
export const CLIENT_DAILY_CEILING = 30;

/** 프록시 헤더에서 클라이언트 IP 추출. 값이 없으면(로컬 등) null. */
export function clientIpFrom(headers: Headers): string | null {
  // Vercel은 x-real-ip에 실제 클라이언트 IP를 넣는다. x-forwarded-for는 프록시 체인이라
  // 첫 항목을 쓰되, 둘 다 없으면 판정 자체를 건너뛴다(로컬 개발).
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || null;
}

/** YYYY-MM-DD (UTC). 버킷의 유효기간이자 솔트 회전 주기. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * IP → 당일 전용 해시. 날짜가 바뀌면 같은 IP라도 다른 값이 되어 추적이 끊긴다.
 * 솔트가 없으면 서버 전용 키로 폴백(별도 환경변수 추가 없이 동작).
 */
function bucketKey(ip: string, day: string): string {
  const secret =
    process.env.RATE_LIMIT_SALT ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "stage-local-dev";
  const dailySalt = createHmac("sha256", secret).update(day).digest();
  return createHmac("sha256", dailySalt).update(ip).digest("hex").slice(0, 32);
}

/**
 * 오늘 사용량을 1 올리고, 천장을 넘었는지 알려준다.
 * 실패해도 서비스를 막지 않는다(카운터는 부가 기능 — 오류 시 통과시킨다).
 */
export async function hitClientCeiling(
  ip: string | null,
): Promise<{ exceeded: boolean; count: number }> {
  if (!ip) return { exceeded: false, count: 0 };
  const day = today();
  const keyHash = bucketKey(ip, day);

  try {
    const row = await prisma.aiRateLimit.upsert({
      where: { keyHash_day: { keyHash, day } },
      create: { keyHash, day, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    // 지난 날짜 버킷 정리 — 보유기간을 '당일'로 유지한다. best-effort.
    prisma.aiRateLimit
      .deleteMany({ where: { day: { lt: day } } })
      .catch(() => undefined);

    return { exceeded: row.count > CLIENT_DAILY_CEILING, count: row.count };
  } catch (err) {
    console.error("[rate-limit] client ceiling check failed:", err);
    return { exceeded: false, count: 0 };
  }
}

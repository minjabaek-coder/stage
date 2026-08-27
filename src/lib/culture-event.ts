/**
 * 문화예술 이벤트가 **이미 끝났는가**.
 *
 * 왜 필요한가: 티켓 목록에 날짜 조건이 없어, 2026-07-12에 끝난 공연을 8월 말까지
 * "회원 티켓 할인"으로 노출하고 상세에서 **예매 버튼까지 눌리게** 두고 있었다.
 * 조회수 0인 화면이 방문자의 신뢰를 깎고 있었던 셈이다.
 *
 * 판정 기준:
 * - 마지막 날(`endDate`, 없으면 `startDate`)이 **오늘보다 이전**이면 종료.
 *   시각이 아니라 **날짜**로 비교한다 — 오늘 저녁 공연을 오전에 "종료"로 감추면 안 된다.
 * - 날짜를 **KST 기준**으로 본다. 한국 독자를 위한 서비스라 UTC로 자르면
 *   한국 시간 오전 9시 이전에 하루가 밀린다.
 * - 날짜가 아예 없으면(상시 전시 등) 종료로 보지 않는다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜를 `YYYYMMDD` 정수로. 시각을 버리고 날짜만 비교하기 위한 값. */
function kstDayNumber(input: Date | string): number {
  const d = new Date(input);
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return k.getUTCFullYear() * 10000 + (k.getUTCMonth() + 1) * 100 + k.getUTCDate();
}

export function isPastEvent(
  startDate: Date | string | null,
  endDate: Date | string | null,
  now: Date = new Date(),
): boolean {
  const last = endDate ?? startDate;
  if (!last) return false; // 날짜 미지정(상시) — 종료로 보지 않는다
  return kstDayNumber(last) < kstDayNumber(now);
}

/**
 * KST 기준 오늘 00:00에 해당하는 UTC 시각. DB 질의에서 "아직 안 끝난 것"을 고를 때 쓴다.
 *
 * `startDate >= now`로 거르면 **진행 중인 공연이 사라진다** — 어제 시작해 다음 주까지
 * 하는 공연이 가장 관련성 높은데도 목록에서 빠졌다(사이드바에서 실제로 그랬다).
 */
export function kstTodayStartUtc(now: Date = new Date()): Date {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  const midnightKst = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  return new Date(midnightKst - KST_OFFSET_MS);
}

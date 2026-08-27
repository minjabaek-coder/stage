import { describe, it, expect } from "vitest";
import { isPastEvent } from "./culture-event";

// 실제로 있었던 문제: 2026-07-12에 끝난 공연을 8월 말까지 "회원 할인"으로 노출하고
// 예매 버튼까지 눌리게 뒀다. 경계(오늘/어제)와 시간대(KST)가 판정의 전부다.

describe("isPastEvent", () => {
  const now = new Date("2026-08-27T03:00:00Z"); // KST 8/27 12:00

  it("어제 끝난 공연은 종료", () => {
    expect(isPastEvent("2026-08-20T10:00:00Z", "2026-08-26T10:00:00Z", now)).toBe(true);
  });

  it("오늘이 마지막 날이면 아직 종료가 아니다", () => {
    // 오늘 저녁 공연을 오전에 감추면 안 된다.
    expect(isPastEvent("2026-08-27T01:00:00Z", "2026-08-27T01:00:00Z", now)).toBe(false);
  });

  it("앞으로 열릴 공연은 종료가 아니다", () => {
    expect(isPastEvent("2026-09-01T10:00:00Z", null, now)).toBe(false);
  });

  it("endDate가 없으면 startDate로 판정한다", () => {
    expect(isPastEvent("2026-08-26T10:00:00Z", null, now)).toBe(true);
    expect(isPastEvent("2026-08-27T10:00:00Z", null, now)).toBe(false);
  });

  it("날짜가 아예 없으면 종료로 보지 않는다(상시 전시 등)", () => {
    expect(isPastEvent(null, null, now)).toBe(false);
  });

  // KST 경계 — UTC로 자르면 한국 시간 오전 9시 이전에 하루가 밀린다.
  it("KST 기준으로 날짜를 자른다", () => {
    // UTC 2026-08-26T20:00 = KST 2026-08-27 05:00 → 아직 오늘
    const kstEarlyMorning = new Date("2026-08-26T20:00:00Z");
    expect(isPastEvent("2026-08-26T15:00:00Z", null, kstEarlyMorning)).toBe(false);
    // 같은 순간에 KST 8/25에 끝난 공연은 종료
    expect(isPastEvent("2026-08-24T15:00:00Z", null, kstEarlyMorning)).toBe(true);
  });

  it("실제 데이터 — 7월에 끝난 두 공연은 8월 말에 종료", () => {
    expect(isPastEvent("2026-07-03T00:00:00Z", "2026-07-12T00:00:00Z", now)).toBe(true);
    expect(isPastEvent("2026-06-29T00:00:00Z", "2026-07-10T00:00:00Z", now)).toBe(true);
  });
});

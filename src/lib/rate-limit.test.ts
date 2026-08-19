import { describe, it, expect } from "vitest";
import { clientIpFrom, SESSION_DAILY_LIMIT, CLIENT_DAILY_CEILING } from "./rate-limit";

// 게스트 한도의 서버 측 축(decisions/0009). DB를 타는 부분은 여기서 다루지 않고,
// 헤더에서 IP를 뽑는 순수 로직과 한도 값의 관계만 고정한다.

describe("clientIpFrom", () => {
  it("x-real-ip를 우선한다(Vercel이 실제 클라이언트 IP를 넣는 헤더)", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "1.2.3.4" });
    expect(clientIpFrom(h)).toBe("203.0.113.5");
  });

  it("x-real-ip가 없으면 x-forwarded-for의 첫 항목", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" });
    expect(clientIpFrom(h)).toBe("203.0.113.9");
  });

  it("둘 다 없으면 null — 판정을 건너뛴다(로컬 개발)", () => {
    expect(clientIpFrom(new Headers())).toBeNull();
  });

  it("빈 값·공백만 있으면 null", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "   " }))).toBeNull();
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " , 1.2.3.4" }))).toBeNull();
  });
});

describe("한도 값의 관계", () => {
  it("서버 측 천장이 세션 한도보다 커야 한다", () => {
    // 천장이 세션 한도보다 낮거나 같으면 정상 이용자가 먼저 막힌다.
    // CGNAT·사무실 NAT 뒤에서 여러 명이 한 IP를 공유하므로 충분한 여유가 필요하다.
    expect(CLIENT_DAILY_CEILING).toBeGreaterThan(SESSION_DAILY_LIMIT);
  });
});

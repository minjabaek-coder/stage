import { describe, it, expect, vi, afterEach } from "vitest";
import { describeError, isDbUnavailableError, safeRead } from "./db-safe";

// 이 모듈의 가치는 "무엇을 삼키지 않는가"에 있다. 과하게 삼키면 결함이 빈 화면으로
// 숨고(디버깅 불가), 덜 삼키면 애초의 목적인 홈 500을 못 막는다. 경계를 고정한다.

describe("isDbUnavailableError — 삼켜야 하는 인프라 장애", () => {
  it("프로젝트 삭제로 DNS가 사라진 경우(실제 사고 신호)", () => {
    expect(isDbUnavailableError(Object.assign(new Error("getaddrinfo ENOTFOUND db.x.supabase.co"), { code: "ENOTFOUND" }))).toBe(true);
  });

  it("pooler의 tenant 소멸 — XX000 / 메시지 둘 다", () => {
    expect(isDbUnavailableError(Object.assign(new Error("Tenant or user not found"), { code: "XX000" }))).toBe(true);
    expect(isDbUnavailableError(new Error("Tenant or user not found"))).toBe(true);
  });

  it("Prisma 접속 계열 코드", () => {
    for (const code of ["P1001", "P1002", "P1017", "P2024"]) {
      expect(isDbUnavailableError(Object.assign(new Error("x"), { code }))).toBe(true);
    }
  });

  it("PrismaClientInitializationError는 이름만으로 판정", () => {
    const e = new Error("init failed");
    e.name = "PrismaClientInitializationError";
    expect(isDbUnavailableError(e)).toBe(true);
  });

  it("어댑터가 pg 오류를 cause로 감싼 경우도 찾아낸다", () => {
    const outer = new Error("Invalid `prisma.magazine.findMany()` invocation", {
      cause: Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }),
    });
    expect(isDbUnavailableError(outer)).toBe(true);
  });

  it("IPv4/IPv6 둘 다 실패해 AggregateError로 오는 경우", () => {
    const agg = Object.assign(new Error("all attempts failed"), {
      errors: [Object.assign(new Error("x"), { code: "ETIMEDOUT" })],
    });
    expect(isDbUnavailableError(agg)).toBe(true);
  });

  it("인증 실패(비밀번호 회전 후)도 인프라로 본다", () => {
    expect(isDbUnavailableError(Object.assign(new Error("password authentication failed"), { code: "28P01" }))).toBe(true);
  });
});

describe("isDbUnavailableError — 삼키면 안 되는 것", () => {
  it("Next의 notFound()·redirect() 제어흐름", () => {
    expect(isDbUnavailableError(Object.assign(new Error("x"), { digest: "NEXT_NOT_FOUND" }))).toBe(false);
    expect(isDbUnavailableError(Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;replace;/auth/login;307;" }))).toBe(false);
  });

  it("제어흐름 예외는 메시지에 인프라 단서가 섞여 있어도 통과시킨다", () => {
    // digest 판정이 메시지 휴리스틱보다 먼저여야 한다.
    const e = Object.assign(new Error("connection refused"), { digest: "NEXT_NOT_FOUND" });
    expect(isDbUnavailableError(e)).toBe(false);
  });

  it("Prisma 쿼리 오류(제약 위반·없는 컬럼)는 결함이므로 드러나야 한다", () => {
    for (const code of ["P2002", "P2003", "P2025", "P2021"]) {
      expect(isDbUnavailableError(Object.assign(new Error("x"), { code }))).toBe(false);
    }
  });

  it("평범한 코드 버그", () => {
    expect(isDbUnavailableError(new TypeError("x.map is not a function"))).toBe(false);
    expect(isDbUnavailableError(undefined)).toBe(false);
    expect(isDbUnavailableError(null)).toBe(false);
  });
});

describe("describeError — 빈 메시지로는 장애를 진단할 수 없다", () => {
  it("message가 비어도 이름과 코드가 남는다", () => {
    // 실측: Prisma 어댑터 오류는 message가 공백인 경우가 흔하다.
    const e = new Error("");
    e.name = "PrismaClientInitializationError";
    Object.assign(e, { code: "P1001" });
    expect(describeError(e)).toBe("PrismaClientInitializationError code=P1001");
  });

  it("cause까지 한 줄에 적는다", () => {
    const e = new Error("query failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }),
    });
    expect(describeError(e)).toBe(
      "Error query failed · cause: Error code=ENOTFOUND getaddrinfo ENOTFOUND"
    );
  });

  it("Error가 아닌 값도 삼키지 않고 문자열로 남긴다", () => {
    expect(describeError("boom")).toBe("boom");
  });
});

describe("safeRead", () => {
  afterEach(() => vi.restoreAllMocks());

  it("성공하면 ok:true + 실제 데이터", async () => {
    await expect(safeRead(async () => [1, 2], [])).resolves.toEqual({ ok: true, data: [1, 2] });
  });

  it("인프라 장애면 ok:false + 폴백, 그리고 로그를 남긴다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await safeRead(
      async () => {
        throw Object.assign(new Error("Tenant or user not found"), { code: "XX000" });
      },
      [] as number[],
      "magazine.findMany"
    );
    expect(res).toEqual({ ok: false, data: [] });
    expect(spy).toHaveBeenCalledOnce();
  });

  it("그 외 오류는 그대로 던진다", async () => {
    await expect(
      safeRead(async () => {
        throw new TypeError("real bug");
      }, null)
    ).rejects.toThrow("real bug");
  });

  it("notFound()를 호출하는 쿼리 래퍼를 막지 않는다", async () => {
    await expect(
      safeRead(async () => {
        throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
      }, null)
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });

  it("ok:false일 때 '정말 비어 있음'과 구분된다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const empty = await safeRead(async () => [] as number[], []);
    const down = await safeRead(
      async () => {
        throw Object.assign(new Error("x"), { code: "P1001" });
      },
      [] as number[]
    );
    expect(empty.data).toEqual(down.data);
    expect(empty.ok).toBe(true);
    expect(down.ok).toBe(false);
  });
});

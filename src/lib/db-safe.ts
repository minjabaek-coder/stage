// DB·인프라 장애를 "페이지 500"이 아니라 "빈 상태"로 떨어뜨리는 폴백 래퍼.
//
// 배경(2026-10-10): Supabase 프로젝트가 소멸하자 DB를 읽는 공개 페이지가 전부 서버
// 렌더 중 throw → 홈이 500이 되어 **사이트 전체가 접속 불가**로 보였다. DB를 쓰지
// 않는 `/about`은 200이었다. 즉 사이트는 살아 있는데 입구만 막힌 상태였다.
// 콘텐츠를 못 보여주는 것은 어쩔 수 없지만, 사이트가 열리지 않는 것은 피할 수 있다.
//
// 설계의 전부는 **무엇을 삼키고 무엇을 다시 던지는가**다.
//  · 삼킨다 — 접속·인증·타임아웃 등 **인프라 장애**. 쿼리를 고쳐도 해결되지 않고,
//    재시도만이 답이므로 빈 화면으로 떨어뜨리는 편이 낫다.
//  · 다시 던진다 — 그 외 전부. 특히 두 가지를 반드시 통과시킨다:
//      ① Next 제어흐름 예외(`redirect()`·`notFound()`) — 삼키면 라우팅이 깨진다.
//      ② Prisma 쿼리 오류(제약 위반·잘못된 인자) — 삼키면 **결함이 빈 화면으로 숨는다**.
//
// 쓰기 경로에는 쓰지 않는다. 저장 실패를 조용히 성공처럼 보이게 만들면 안 된다.

// 읽기 결과. `ok:false`는 "DB가 응답하지 않아 폴백을 쓰는 중"을 뜻한다.
// 호출처가 **"정말 비어 있음"과 "지금 못 읽음"을 구분**할 수 있어야 하므로
// 폴백값만 돌려주지 않고 성공 여부를 함께 싣는다.
export type DbRead<T> = { ok: boolean; data: T };

// Next가 제어흐름에 쓰는 예외(redirect/notFound/forbidden 등). 삼키면 안 된다.
function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string") return false;
  return (
    digest === "NEXT_NOT_FOUND" ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}

// Prisma 접속 계열 오류 코드. 쿼리 오류(P2xxx)는 의도적으로 제외한다 —
// 예외는 P2024(커넥션 풀 타임아웃)로, 쿼리가 아니라 접속 자원 문제다.
const PRISMA_INFRA_CODES = new Set([
  "P1000", // 인증 실패
  "P1001", // 서버에 도달할 수 없음
  "P1002", // 접속 타임아웃
  "P1003", // 데이터베이스가 존재하지 않음
  "P1008", // 작업 타임아웃
  "P1010", // 접근 거부
  "P1011", // TLS 연결 오류
  "P1017", // 서버가 연결을 닫음
  "P2024", // 커넥션 풀에서 커넥션을 얻지 못함
  "P5010", // 요청 전달 실패(Accelerate/프록시)
]);

// PostgreSQL SQLSTATE — 08=연결 예외, 28=인증, 53300=too many connections,
// 57P0x=관리자 종료/셧다운, 3D000=없는 DB, XX000=내부 오류(pooler의 "Tenant or
// user not found"가 이 코드로 온다).
const PG_INFRA_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08P01",
  "28000",
  "28P01",
  "3D000",
  "53300",
  "57P01",
  "57P02",
  "57P03",
  "XX000",
]);

// Node 소켓/DNS 오류. 프로젝트가 삭제되면 서브도메인이 사라져 ENOTFOUND가 뜬다.
const NET_INFRA_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

// 코드가 없는 경로(어댑터가 메시지만 넘겨줄 때)를 위한 최후의 단서.
// 좁게 — 일반적인 단어로 매칭하면 쿼리 결함까지 삼키게 된다.
const INFRA_MESSAGE_HINTS = [
  "can't reach database server",
  "tenant or user not found",
  "timeout exceeded when trying to connect",
  "connection terminated",
  "connection refused",
  "connection closed",
  "getaddrinfo",
  "server has closed the connection",
  "too many clients",
  "terminating connection",
];

const INFRA_ERROR_NAMES = new Set([
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
]);

// 인프라 장애인가. 래핑된 오류를 고려해 `cause` 체인을 따라 내려간다
// (드라이버 어댑터는 pg 오류를 Prisma 오류 안에 싣는 경우가 많다).
export function isDbUnavailableError(error: unknown): boolean {
  if (isNextControlFlowError(error)) return false;

  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth++) {
    const e = current as {
      name?: unknown;
      code?: unknown;
      message?: unknown;
      errors?: unknown;
      cause?: unknown;
    };

    if (typeof e.name === "string" && INFRA_ERROR_NAMES.has(e.name)) return true;
    if (typeof e.code === "string") {
      const code = e.code;
      if (
        PRISMA_INFRA_CODES.has(code) ||
        PG_INFRA_CODES.has(code) ||
        NET_INFRA_CODES.has(code)
      ) {
        return true;
      }
    }
    if (typeof e.message === "string") {
      const msg = e.message.toLowerCase();
      if (INFRA_MESSAGE_HINTS.some((hint) => msg.includes(hint))) return true;
    }
    // AggregateError(DNS가 IPv4/IPv6 둘 다 실패할 때 pg가 내보낸다)
    if (Array.isArray(e.errors) && e.errors.some(isDbUnavailableError)) return true;

    current = e.cause;
  }
  return false;
}

// 로그용 요약. Prisma/pg 오류는 `message`가 비어 있는 경우가 흔해(실측: 전부 공백)
// 이름·코드·cause까지 함께 적어야 로그만 보고 원인을 짚을 수 있다.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const summarize = (e: Error): string => {
    const code = (e as { code?: unknown }).code;
    return [e.name, typeof code === "string" ? `code=${code}` : null, e.message]
      .filter(Boolean)
      .join(" ");
  };

  const parts = [summarize(error)];
  if (error.cause instanceof Error) parts.push(`cause: ${summarize(error.cause)}`);
  return parts.join(" · ");
}

// DB 읽기를 감싼다. 인프라 장애면 폴백으로, 그 외 오류는 그대로 던진다.
//
//   const mags = await safeRead(() => prisma.magazine.findMany({ ... }), []);
//   if (!mags.ok) { /* "지금 못 읽음" 안내 */ }
//   mags.data.map(...)
export async function safeRead<T>(
  run: () => Promise<T>,
  fallback: T,
  label?: string
): Promise<DbRead<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (!isDbUnavailableError(error)) throw error;
    // 장애는 조용히 넘기지 않는다 — 빈 화면만 보면 원인을 알 수 없다.
    console.error(
      `[db-safe] DB 읽기 실패로 폴백 사용${label ? ` (${label})` : ""}: ${describeError(error)}`
    );
    return { ok: false, data: fallback };
  }
}

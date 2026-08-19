// Prisma CLI 설정(migrate·studio 전용). 앱 런타임은 이 파일을 쓰지 않는다 —
// src/lib/prisma.ts가 PrismaPg 어댑터로 DATABASE_URL에 직접 붙는다.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// 이 프로젝트의 로컬 환경변수는 `.env`가 아니라 `.env.local`에 있다(Next.js 관례).
// dotenv 기본값(.env)만 읽으면 datasource.url이 undefined가 되어 migrate가 실패한다.
// Vercel에는 두 파일 모두 없지만 플랫폼이 env를 주입하므로 무해하다.
loadEnv({ path: ".env.local" });
loadEnv(); // .env가 있으면 추가로(기존 값은 덮어쓰지 않음)

// ── 파괴적 명령 차단 (roadmap S0-1) ─────────────────────────────────────────
// 이 프로젝트는 dev DB가 없어 DATABASE_URL이 곧 **운영 DB**다(BLK-5 보류 중).
// CLAUDE.md에 "쓰지 말 것"이라고 적혀 있었을 뿐 강제되지 않았다 → 규칙을 코드로 바꾼다.
//
// npm 스크립트로 감싸는 방식은 실효가 없다. 위험한 명령이 곧 `npx prisma db push`라
// 스크립트를 거치지 않기 때문이다. Prisma CLI는 **모든 서브커맨드에서 이 설정 파일을
// 먼저 로드**하므로, 여기서 argv를 보고 중단하는 것이 유일하게 우회되지 않는 지점이다.
//
// 정말 실행해야 한다면 ALLOW_DESTRUCTIVE_DB=1 을 붙인다(의도적 행위로 만들기 위함).
const DESTRUCTIVE: { cmd: string[]; why: string }[] = [
  {
    cmd: ["db", "push"],
    why: "schema.prisma에 없는 테이블을 DROP한다 (BlogPostChunk는 raw SQL 마이그레이션 산물이라 모델에 없음)",
  },
  { cmd: ["migrate", "reset"], why: "데이터베이스를 통째로 비운다" },
  {
    cmd: ["migrate", "dev"],
    why: "드리프트를 감지하면 reset을 유도하고, 운영 DB에 shadow database를 만든다",
  },
  { cmd: ["db", "execute"], why: "임의 SQL을 그대로 실행한다" },
];

function hostOf(url: string | undefined): string {
  if (!url) return "(DATABASE_URL 없음)";
  try {
    return new URL(url).host;
  } catch {
    return "(파싱 불가)";
  }
}

function guardDestructive(): void {
  // 서브커맨드만 추림(플래그 제외). `npx prisma db push --force-reset` → ["db","push"]
  const argv = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const hit = DESTRUCTIVE.find((d) => d.cmd.every((tok, i) => argv[i] === tok));
  if (!hit) return;

  const target = hostOf(process.env["DATABASE_URL"]);
  if (process.env["ALLOW_DESTRUCTIVE_DB"] === "1") {
    console.warn(
      `\n⚠️  ALLOW_DESTRUCTIVE_DB=1 — \`prisma ${hit.cmd.join(" ")}\` 를 허용합니다.\n` +
        `    대상: ${target}\n    ${hit.why}\n`,
    );
    return;
  }

  console.error(
    [
      "",
      "╔══════════════════════════════════════════════════════════════════════╗",
      "║  차단됨: 운영 DB에 파괴적인 명령입니다                                ║",
      "╚══════════════════════════════════════════════════════════════════════╝",
      `  명령 : prisma ${hit.cmd.join(" ")}`,
      `  대상 : ${target}`,
      `  이유 : ${hit.why}`,
      "",
      "  이 프로젝트는 별도 dev DB가 없어 DATABASE_URL이 곧 운영 DB입니다.",
      "  스키마 변경은 마이그레이션 파일을 작성해 `prisma migrate deploy` 로 적용하세요.",
      "  (마이그레이션은 멱등하게 — ADD COLUMN IF NOT EXISTS 등)",
      "",
      "  그래도 실행해야 한다면 의도를 명시하세요:",
      `    ALLOW_DESTRUCTIVE_DB=1 npx prisma ${hit.cmd.join(" ")}`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

guardDestructive();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 마이그레이션은 **세션 모드** 연결이 필요하다. DATABASE_URL은 Supabase
    // Transaction Pooler(port 6543, pgbouncer)라 advisory lock을 못 잡고 무한 대기한다.
    // → 같은 호스트의 세션 포트(5432)를 DIRECT_URL로 주고, 없으면 6543을 5432로 치환.
    url:
      process.env["DIRECT_URL"] ??
      process.env["DATABASE_URL"]?.replace(":6543/", ":5432/"),
  },
});

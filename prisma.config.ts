// Prisma CLI 설정(migrate·studio 전용). 앱 런타임은 이 파일을 쓰지 않는다 —
// src/lib/prisma.ts가 PrismaPg 어댑터로 DATABASE_URL에 직접 붙는다.
import fs from "node:fs";
import path from "node:path";
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

// ── 마이그레이션 전 백업 확인 (roadmap S0-1b) ───────────────────────────────
// Supabase **Free plan에는 project backup이 없다** → `scripts/db-backup.mjs` 덤프가
// 유일한 복구 수단이다. `migrate deploy`는 되돌리기 어려운 작업이므로 최근 백업을 요구한다.
//
// 백업을 여기서 자동 실행하지는 않는다(매 배포마다 수십 초가 붙고, 백업 실패가 배포를
// 막는다). 대신 **검사만** 하고 안내한다 — 강제력은 같으면서 기다림이 없다.
const BACKUP_MAX_AGE_H = 24;

function guardBackup(): void {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (!(argv[0] === "migrate" && argv[1] === "deploy")) return;
  if (process.env["SKIP_BACKUP_CHECK"] === "1") {
    console.warn("\n⚠️  SKIP_BACKUP_CHECK=1 — 백업 확인을 건너뜁니다.\n");
    return;
  }

  const dir = "backups";
  let newestAgeH = Infinity;
  let newest = "";
  try {
    for (const name of fs.readdirSync(dir)) {
      const manifest = path.join(dir, name, "manifest.json");
      if (!fs.existsSync(manifest)) continue; // 완료되지 않은 백업은 무시
      const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
      if (!m.verified) continue; // 검증 실패한 백업은 없는 것으로 본다
      const ageH = (Date.now() - new Date(m.takenAt).getTime()) / 36e5;
      if (ageH < newestAgeH) {
        newestAgeH = ageH;
        newest = name;
      }
    }
  } catch {
    /* backups/ 없음 → 아래에서 안내 */
  }

  if (newestAgeH <= BACKUP_MAX_AGE_H) {
    console.log(
      `\n✔ 최근 백업 확인: backups/${newest} (${newestAgeH.toFixed(1)}시간 전)\n`,
    );
    return;
  }

  console.error(
    [
      "",
      "╔══════════════════════════════════════════════════════════════════════╗",
      "║  중단됨: 최근 백업이 없습니다                                          ║",
      "╚══════════════════════════════════════════════════════════════════════╝",
      `  migrate deploy 는 되돌리기 어렵고, 이 프로젝트의 Supabase 플랜에는`,
      `  자동 백업이 없습니다. ${BACKUP_MAX_AGE_H}시간 이내의 검증된 백업이 필요합니다.`,
      newest
        ? `  가장 최근 백업: backups/${newest} (${newestAgeH.toFixed(1)}시간 전 — 너무 오래됨)`
        : "  검증된 백업이 하나도 없습니다.",
      "",
      "  먼저 백업하세요:",
      "    npm run db:backup",
      "",
      "  (백업까지 한 번에: npm run db:deploy)",
      "  의도적으로 건너뛰려면: SKIP_BACKUP_CHECK=1 npx prisma migrate deploy",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

guardBackup();

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

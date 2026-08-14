// Prisma CLI 설정(migrate·studio 전용). 앱 런타임은 이 파일을 쓰지 않는다 —
// src/lib/prisma.ts가 PrismaPg 어댑터로 DATABASE_URL에 직접 붙는다.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// 이 프로젝트의 로컬 환경변수는 `.env`가 아니라 `.env.local`에 있다(Next.js 관례).
// dotenv 기본값(.env)만 읽으면 datasource.url이 undefined가 되어 migrate가 실패한다.
// Vercel에는 두 파일 모두 없지만 플랫폼이 env를 주입하므로 무해하다.
loadEnv({ path: ".env.local" });
loadEnv(); // .env가 있으면 추가로(기존 값은 덮어쓰지 않음)

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

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL!,
      max: 3,
      // DB가 응답하지 않을 때 **얼마나 빨리 포기하는가**. 기본값은 무한 대기라
      // 장애 시 요청이 Vercel 함수 타임아웃까지 매달려 있다 — 사용자에게는 영구
      // 로딩으로 보인다. 10초면 degraded 안내로 넘어가고(db-safe), 일시적 지연
      // (free plan 프로젝트가 깨어나는 경우 등)에는 아직 여유가 있다.
      connectionTimeoutMillis: 10_000,
    },
    { schema: "public" }
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

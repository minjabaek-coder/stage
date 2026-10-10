import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeRead } from "@/lib/db-safe";
import type { UserTier } from "@/generated/prisma/client";
import { MyStage } from "./my-stage";
import { ArchiveNav, type ArchiveGroup } from "./archive-nav";

// 등급별 24h AI 질문 한도(W4-4). pro는 무제한.
const AI_LIMIT: Record<UserTier, number> = {
  guest: 5,
  member: 30,
  pro: Infinity,
};

type Mag = {
  id: string;
  issueNumber: number;
  publishedAt: Date | null;
};

// 홈 좌측 레일(page-home §A): My STAGE(로그인 시) + 아카이브(항상).
export async function LeftRail({ magazines }: { magazines: Mag[] }) {
  // 공용 셸의 일부 — 여기서 throw하면 **본문과 무관하게 페이지 전체가 500**이 된다.
  // DB 장애 시에는 비로그인 상태로 보이게 두고(레일은 아카이브만) 페이지를 살린다.
  const user = await tryGetCurrentUser();

  let myStage = null;
  if (user) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [bookmarkCount, aiUsed] = await Promise.all([
      safeRead(
        () => prisma.bookmark.count({ where: { userId: user.id } }),
        0,
        "leftRail:bookmarkCount"
      ),
      safeRead(
        () =>
          prisma.aiInteraction.count({
            where: { userId: user.id, createdAt: { gte: startOfDay } },
          }),
        0,
        "leftRail:aiUsed"
      ),
    ]);
    myStage = (
      <MyStage
        name={user.name}
        tier={user.tier}
        bookmarkCount={bookmarkCount.data}
        aiUsed={aiUsed.data}
        aiLimit={AI_LIMIT[user.tier]}
        interests={user.interests}
      />
    );
  }

  return (
    <div className="space-y-3.5">
      {myStage}
      <ArchiveNav groups={groupByYear(magazines)} />
    </div>
  );
}

function groupByYear(mags: Mag[]): ArchiveGroup[] {
  const map = new Map<number, ArchiveGroup["items"]>();
  for (const m of mags) {
    const d = m.publishedAt ? new Date(m.publishedAt) : null;
    const year = d ? d.getFullYear() : 0;
    const month = d ? d.getMonth() + 1 : 0;
    const list = map.get(year) ?? [];
    list.push({ id: m.id, issueNumber: m.issueNumber, month });
    map.set(year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }));
}

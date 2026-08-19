export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { AiIndexTable, type IndexRow } from "@/components/admin/ai-index-table";
import { parseSourceSections, isIndexable, MIN_INDEXABLE_LENGTH } from "@/types/magazine-source";

// AI 색인 현황 (roadmap S1-3).
//
// **상태 필드를 따로 두지 않는다.** ContentChunk가 곧 "색인됐는가"의 기록이므로,
// 별도 컬럼을 두면 두 번째 진실이 생겨 어긋난다(이 저장소가 반복해서 겪은 문제 —
// 마이그레이션 장부 드리프트, 문서-코드 드리프트). 여기서는 청크에서 파생시킨다.
//
// 참고: 스키마의 `BlogPost.embeddingStatus`는 레거시 모델(공개 라우트·데이터 없음,
// 색인 제외)에만 있고 Article에는 없다. 사용처가 없어 정리 대상(S2-2).

type ChunkStat = { count: number; lastAt: Date | null };

export default async function AdminAiIndexPage() {
  const [chunkRows, articles, magazines, events] = await Promise.all([
    prisma.$queryRaw<{ sourceType: string; sourceId: string; n: bigint; last: Date }[]>`
      SELECT "sourceType", "sourceId", count(*) AS n, max("createdAt") AS last
        FROM "ContentChunk" GROUP BY "sourceType", "sourceId"
    `,
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true, aiIndexable: true, content: true },
    }),
    prisma.magazine.findMany({
      where: { status: "published" },
      orderBy: { issueNumber: "desc" },
      select: {
        id: true,
        issueNumber: true,
        title: true,
        sourceSections: true,
        _count: { select: { pages: true } },
      },
    }),
    prisma.cultureEvent.findMany({
      where: { status: "published" },
      orderBy: { startDate: "desc" },
      select: { id: true, title: true, slug: true },
    }),
  ]);

  const stats = new Map<string, ChunkStat>();
  for (const r of chunkRows) {
    stats.set(`${r.sourceType}:${r.sourceId}`, { count: Number(r.n), lastAt: r.last });
  }
  const stat = (t: string, id: string): ChunkStat =>
    stats.get(`${t}:${id}`) ?? { count: 0, lastAt: null };

  const rows: IndexRow[] = [];

  for (const a of articles) {
    const s = stat("article", a.id);
    // 색인 '대상'인지와 '됐는지'를 분리한다 — 대상이 아니면 청크 0이 정상이다.
    const expected = a.aiIndexable && !!a.content?.trim();
    rows.push({
      type: "article",
      id: a.id,
      label: a.title,
      href: `/articles/${a.slug}`,
      note: a.aiIndexable ? "" : "AI 색인 제외 설정",
      expected,
      chunks: s.count,
      lastAt: s.lastAt?.toISOString() ?? null,
    });
  }

  for (const m of magazines) {
    const s = stat("magazine", m.id);
    const sections = parseSourceSections(m.sourceSections);
    const usable = sections.filter(
      (x) => isIndexable(x) && x.text.trim().length >= MIN_INDEXABLE_LENGTH,
    ).length;
    rows.push({
      type: "magazine",
      id: m.id,
      label: `${m.issueNumber}호 · ${m.title}`,
      href: `/admin/magazines/${m.id}/edit`,
      note: usable > 0 ? `원문 구간 ${usable}개` : "원문 없음 — 구간을 입력하면 색인됩니다",
      expected: usable > 0,
      chunks: s.count,
      lastAt: s.lastAt?.toISOString() ?? null,
    });
  }

  for (const e of events) {
    const s = stat("culture", e.id);
    rows.push({
      type: "culture",
      id: e.id,
      label: e.title,
      href: `/culture-events/${e.slug}`,
      note: "",
      expected: true,
      chunks: s.count,
      lastAt: s.lastAt?.toISOString() ?? null,
    });
  }

  const missing = rows.filter((r) => r.expected && r.chunks === 0).length;
  const totalChunks = rows.reduce((n, r) => n + r.chunks, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 색인 현황</h1>
        <p className="mt-1 text-sm text-gray-500">
          발행된 콘텐츠가 마에스트로 검색에 실제로 들어가 있는지 — 청크 총 {totalChunks}개
          {missing > 0 && (
            <span className="ml-1 font-medium text-red-600">· 미색인 {missing}건</span>
          )}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          색인은 발행·저장의 부수효과로 돌기 때문에 실패해도 드러나지 않았습니다. 여기서
          확인하고 개별 재색인할 수 있습니다.
        </p>
      </div>
      <AiIndexTable rows={rows} />
    </div>
  );
}

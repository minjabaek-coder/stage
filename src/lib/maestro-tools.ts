import { prisma } from "@/lib/prisma";
import { searchChunks } from "@/lib/rag";

export interface ToolSource {
  title: string;
  href: string;
}

// AI 마에스트로 도구 선언 (Gemini function calling). 읽기전용·파라미터화.
export const MAESTRO_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_content",
        description:
          "STAGE 매거진·단독 기사·블로그의 본문에서 관련 내용을 의미 기반으로 검색한다. 작품·작곡가·공연 배경·기사 내용 등 '글 내용'에 대한 질문에 사용.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "검색할 자연어 질의" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_magazine_facts",
        description:
          "STAGE 매거진 발행 현황(가장 최신 발행 호 번호, 총 발행 호 수)을 반환한다. '최신호 몇 호', '몇 호까지 나왔어' 등 사실 질문에 사용.",
        parametersJsonSchema: { type: "object", properties: {} },
      },
      {
        name: "get_culture_events",
        description:
          "STAGE가 안내하는 공연·전시·교육 이벤트 목록을 조회한다. '요즘 공연 뭐 있어', 'OO 전시 정보', '교육 프로그램' 등 이벤트 질문에 사용.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "공연 | 전시 | 교육 중 하나로 필터(선택)",
            },
          },
        },
      },
    ],
  },
];

function dedupe(sources: ToolSource[]): ToolSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.href)) return false;
    seen.add(s.href);
    return true;
  });
}

// 도구 실행. result는 모델에 돌려줄 데이터, sources는 클라이언트 출처칩.
export async function executeMaestroTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; sources: ToolSource[] }> {
  if (name === "search_content") {
    const chunks = await searchChunks(String(args.query ?? ""), 5);
    return {
      result: chunks.map((c) => ({
        title: c.title,
        content: c.content.slice(0, 600),
      })),
      sources: dedupe(chunks.map((c) => ({ title: c.title, href: c.href }))),
    };
  }

  if (name === "get_magazine_facts") {
    const [latest, count] = await Promise.all([
      prisma.magazine.findFirst({
        where: { status: "published" },
        orderBy: { issueNumber: "desc" },
        select: { issueNumber: true, title: true },
      }),
      prisma.magazine.count({ where: { status: "published" } }),
    ]);
    return {
      result: {
        latestIssueNumber: latest?.issueNumber ?? null,
        latestIssueTitle: latest?.title ?? null,
        totalPublished: count,
      },
      sources: [],
    };
  }

  if (name === "get_culture_events") {
    const type = typeof args.type === "string" ? args.type : "";
    const valid = ["공연", "전시", "교육"].includes(type);
    const events = await prisma.cultureEvent.findMany({
      where: { status: "published", ...(valid ? { type } : {}) },
      orderBy: { startDate: "desc" },
      take: 6,
      select: {
        slug: true,
        title: true,
        type: true,
        venue: true,
        startDate: true,
        endDate: true,
        ticketPrice: true,
        memberDiscount: true,
      },
    });
    return {
      result: events.map((e) => ({
        title: e.title,
        type: e.type,
        venue: e.venue,
        startDate: e.startDate,
        endDate: e.endDate,
        ticketPrice: e.ticketPrice,
        memberDiscount: e.memberDiscount,
      })),
      sources: events.map((e) => ({
        title: e.title,
        href: `/culture-events/${e.slug}`,
      })),
    };
  }

  return { result: { error: `unknown tool: ${name}` }, sources: [] };
}

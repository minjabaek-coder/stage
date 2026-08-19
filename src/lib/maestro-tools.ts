import { prisma } from "@/lib/prisma";
import { searchChunks } from "@/lib/rag";
import { parseSourceSections } from "@/types/magazine-source";

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
          "STAGE 기사·매거진 본문·문화예술 이벤트 설명에서 관련 내용을 의미 기반으로 검색한다. 작품·작곡가·공연 배경·기사/매거진 내용·이벤트 분위기 등 '내용'에 대한 질문에 사용.",
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
        // 왜 get_magazine_facts를 확장하지 않고 도구를 나눴나:
        // "1호에 뭐 실렸어?"가 search_content(topK=5)로 가면 55쪽짜리 호의 절반만 답한다.
        // 이 문제의 본질은 **라우팅**이라, 설명을 날카롭게 분리하는 편이 정확하다.
        // facts는 파라미터 없는 값싼 사실 조회로 남긴다.
        name: "get_magazine_contents",
        description:
          "특정 호에 '무엇이 실렸는지'(목차 = 꼭지 제목과 실린 페이지 목록)를 반환한다. '1호에 뭐 실렸어', '이번 호 특집이 뭐야', '무슨 리뷰가 있어' 등 호의 구성·목차 질문에 사용. 호 번호를 말하지 않으면 최신 발행호. 특정 꼭지의 '내용'을 물으면 이 도구가 아니라 search_content를 사용한다.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            issueNumber: {
              type: "integer",
              description: "조회할 호 번호(선택). 없으면 최신 발행호",
            },
          },
        },
      },
      {
        name: "get_culture_events",
        description:
          "STAGE가 '지금 티켓 예매·할인을 안내하는' 현재/예정 공연·전시·교육 이벤트 목록을 조회한다. '지금 예매 가능한 공연', 'OO 티켓 할인' 등 현재 진행 이벤트에 한정. 매거진·기사에 실린 공연 소식/리뷰(예: '2025년 10월 공연 소식')는 이 도구가 아니라 search_content를 사용한다.",
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
      // page·section을 모델에 함께 넘겨 "몇 쪽에 있나"·"어느 꼭지인가"에 답할 수 있게 한다.
      // (기존엔 href 문자열에만 들어 있어 모델이 알 수 없었음)
      result: chunks.map((c) => ({
        title: c.title,
        content: c.content.slice(0, 600),
        ...(c.sectionTitle ? { section: c.sectionTitle } : {}),
        ...(c.pageNumber !== null ? { page: c.pageNumber } : {}),
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

  if (name === "get_magazine_contents") {
    const raw = args.issueNumber;
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    const wantIssue = Number.isInteger(n) && n > 0 ? n : null;

    // 발행본만 — 비공개 호가 목차로 새어나가지 않게(RAG와 동일 원칙).
    const mag = await prisma.magazine.findFirst({
      where: { status: "published", ...(wantIssue ? { issueNumber: wantIssue } : {}) },
      orderBy: { issueNumber: "desc" },
      select: {
        id: true,
        issueNumber: true,
        title: true,
        publishedAt: true,
        sourceSections: true,
        tocEntries: {
          orderBy: { sortOrder: "asc" },
          select: { title: true, pageNumber: true },
        },
        pages: {
          orderBy: { pageNumber: "asc" },
          select: {
            pageNumber: true,
            article: { select: { title: true, status: true } },
          },
        },
      },
    });
    if (!mag) {
      return {
        result: {
          error: wantIssue
            ? `${wantIssue}호는 발행된 매거진에서 찾을 수 없습니다`
            : "발행된 매거진이 없습니다",
        },
        sources: [],
      };
    }

    // 목차가 정본. 없으면 원문 구간 제목 → 연동 기사 제목 순으로 폴백한다.
    let contents: { title: string; page: number }[] = mag.tocEntries.map((t) => ({
      title: t.title,
      page: t.pageNumber,
    }));
    let via = "toc";

    if (contents.length === 0) {
      const seen = new Map<string, number>(); // 제목 → 가장 앞 페이지
      for (const s of parseSourceSections(mag.sourceSections)) {
        if (!s.title || s.pageFrom === null) continue;
        const prev = seen.get(s.title);
        if (prev === undefined || s.pageFrom < prev) seen.set(s.title, s.pageFrom);
      }
      contents = [...seen].map(([title, page]) => ({ title, page }));
      via = "sections";
    }
    if (contents.length === 0) {
      const seen = new Map<string, number>();
      for (const p of mag.pages) {
        const t = p.article?.status === "published" ? p.article.title : null;
        if (!t) continue;
        if (!seen.has(t)) seen.set(t, p.pageNumber);
      }
      contents = [...seen].map(([title, page]) => ({ title, page }));
      via = "articles";
    }
    contents.sort((a, b) => a.page - b.page);

    return {
      result: {
        issueNumber: mag.issueNumber,
        title: mag.title,
        publishedAt: mag.publishedAt ? mag.publishedAt.toISOString().slice(0, 10) : null,
        totalPages: mag.pages.length,
        contents,
        contentsFrom: via, // 목차가 없어 폴백했는지 모델이 알 수 있게
      },
      // 항목마다 칩을 만들면 10여 개가 쏟아진다 → 매거진 링크 1개만.
      sources: [
        { title: `STAGE ${mag.issueNumber}호 · ${mag.title}`, href: `/magazines/${mag.id}` },
      ],
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

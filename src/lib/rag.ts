import { prisma } from "@/lib/prisma";
import { chunkBlogContent } from "@/lib/chunker";
import { embedDocuments, embedQuery } from "@/lib/embeddings";
import sanitizeHtml from "sanitize-html";
import { parsePageLayout, parseHtmlLayout } from "@/types/magazine-layout";
import {
  parseSourceSections,
  pageLabel,
  sectionPages,
  isIndexable,
} from "@/types/magazine-source";

export interface ChunkResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  href: string; // 출처 링크 (/articles/.. | /magazines/.. | /culture-events/..)
  pageNumber: number | null; // 매거진 구간의 시작 페이지(없으면 null)
  sectionTitle: string | null; // 구간(꼭지) 제목
}

// 색인 단위. href·pageNumber·sectionTitle은 소스 기본값을 덮어쓰는 청크별 메타데이터.
type IndexChunk = {
  chunkIndex: number;
  content: string;
  title: string;
  href?: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
};

type SourceType = "article" | "magazine" | "culture";

// 한 소스의 청크를 통째로 갈아끼운다(delete-then-insert). 색인 부적격이면 chunks=[]로
// 호출해 기존 청크만 제거(발행취소·색인제외 반영).
// chunk.href/pageNumber/sectionTitle을 주면 그 청크만 다른 출처 메타데이터로 저장한다
// (매거진 원문 구간의 페이지 딥링크·꼭지 제목).
async function replaceChunks(
  sourceType: SourceType,
  sourceId: string,
  href: string,
  title: string,
  chunks: IndexChunk[],
): Promise<void> {
  await prisma.$queryRawUnsafe(
    `DELETE FROM "ContentChunk" WHERE "sourceType" = $1 AND "sourceId" = $2`,
    sourceType,
    sourceId,
  );
  if (chunks.length === 0) return;

  const embeddings = await embedDocuments(chunks.map((c) => c.content));
  for (let i = 0; i < chunks.length; i++) {
    const vec = `[${embeddings[i].join(",")}]`;
    await prisma.$queryRawUnsafe(
      `INSERT INTO "ContentChunk"
         ("id", "sourceType", "sourceId", "chunkIndex", "title", "content", "href",
          "pageNumber", "sectionTitle", "embedding")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
      sourceType,
      sourceId,
      chunks[i].chunkIndex,
      chunks[i].title || title,
      chunks[i].content,
      chunks[i].href || href,
      chunks[i].pageNumber ?? null,
      chunks[i].sectionTitle ?? null,
      vec,
    );
  }
  console.log(`[RAG] ${sourceType} "${title}" → ${chunks.length} chunks`);
}

// 소스 삭제 시 청크 정리(ContentChunk는 FK 없는 독립 테이블 → 명시적 삭제 필요).
export async function deleteContentChunks(
  sourceType: SourceType,
  sourceId: string,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ContentChunk" WHERE "sourceType" = $1 AND "sourceId" = $2`,
    sourceType,
    sourceId,
  );
}

// ── 기사 ───────────────────────────────────────────────────────────────────
// 발행 + aiIndexable + 본문 있는 기사만 색인. 그 외는 기존 청크 제거.
export async function generateArticleEmbeddings(articleId: string): Promise<void> {
  const a = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, slug: true, content: true, status: true, aiIndexable: true },
  });
  if (!a) return;

  const eligible = a.status === "published" && a.aiIndexable && !!a.content;
  const chunks = eligible ? chunkBlogContent(a.content!, a.title) : [];
  await replaceChunks("article", a.id, `/articles/${a.slug}`, a.title, chunks);
}

// kind=html 페이지 본문 텍스트 추출(RAG 색인용) — script/style/head 등을 통째 제거하고
// 태그를 strip해 순수 텍스트만 남긴다. 렌더 격리(iframe sandbox)와 별개의 색인 경로.
function extractText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: ["script", "style", "head", "noscript", "template"],
  })
    .replace(/\s+/g, " ")
    .trim();
}

// ── 매거진 ─────────────────────────────────────────────────────────────────
// 발행 매거진의 텍스트를 두 갈래로 색인한다.
//   ① 페이지 내장 텍스트 — 구성형 text 블록 + HTML 페이지 본문(합쳐서 매거진 단위 청크).
//   ② 원문 구간(sourceSections) — 이미지형처럼 지면에 텍스트가 없는 경우의 코퍼스.
//      구간은 **구조**(페이지 범위·제목)라 본문을 파싱하지 않는다. 각 구간은 시작 페이지
//      딥링크(`?page=N`)와 꼭지 제목을 청크 메타데이터로 갖는다.
// 두 갈래 모두 articleId 연결 페이지(기사가 발행+색인)는 기사 청크로 커버되므로 제외(중복 방지).
// 비발행/텍스트없음이면 청크 제거.
export async function generateMagazineEmbeddings(magazineId: string): Promise<void> {
  const m = await prisma.magazine.findUnique({
    where: { id: magazineId },
    select: {
      id: true,
      title: true,
      issueNumber: true,
      status: true,
      sourceSections: true,
      pages: {
        orderBy: { sortOrder: "asc" },
        select: {
          kind: true,
          layout: true,
          pageNumber: true,
          // 연결 기사가 "발행+색인"이면 그 텍스트는 기사 청크로 커버 → 매거진에서 제외(중복).
          // 그러나 draft/미색인 기사면 기사 청크에 없으므로 매거진 텍스트로 보존해야 누락이 없다.
          article: { select: { status: true, aiIndexable: true } },
        },
      },
    },
  });
  if (!m) return;

  const baseHref = `/magazines/${m.id}`;
  // 청크 제목은 출처칩 문구이자 본문 프리픽스(chunkBlogContent)라 검색 맥락도 겸한다.
  // 호수를 넣어야 "12호에 뭐 실렸어?" 류 질의가 걸린다.
  const baseTitle = `STAGE ${m.issueNumber}호 · ${m.title}`;
  const collected: IndexChunk[] = [];

  if (m.status === "published") {
    // ① 페이지 내장 텍스트
    let combined = "";
    const coveredPages = new Set<number>(); // 기사 청크가 담당하는 페이지(원문 구간에서도 제외)
    for (const pg of m.pages) {
      const coveredByArticle =
        pg.article?.status === "published" && pg.article?.aiIndexable;
      if (coveredByArticle) {
        coveredPages.add(pg.pageNumber);
        continue; // 기사 청크가 이미 담당
      }
      if (pg.kind === "composed") {
        const layout = parsePageLayout(pg.layout);
        if (!layout) continue;
        for (const b of layout.blocks) {
          if (b.type === "text" && b.html) combined += b.html + "\n\n";
        }
      } else if (pg.kind === "html") {
        const hl = parseHtmlLayout(pg.layout);
        const text = hl?.html ? extractText(hl.html) : "";
        if (text) combined += text + "\n\n";
      }
    }
    if (combined.trim()) collected.push(...chunkBlogContent(combined, baseTitle));

    // ② 원문 구간
    for (const sec of parseSourceSections(m.sourceSections)) {
      // 관리자가 색인에서 뺀 구간(표지·광고면 등)은 제외 — 저장은 유지된다.
      if (!isIndexable(sec)) continue;
      if (!sec.text.trim()) continue;
      // 구간이 덮는 페이지가 **전부** 기사로 커버되면 기사 청크와 중복 → 제외.
      // 일부만 겹치면 나머지 내용이 사라지므로 보존한다(누락 < 소폭 중복).
      const pages = sectionPages(sec);
      if (pages.length > 0 && pages.every((p) => coveredPages.has(p))) continue;

      const pages_ = pageLabel(sec);
      const label = [baseTitle, sec.title, pages_].filter(Boolean).join(" · ");
      const href =
        sec.pageFrom !== null ? `${baseHref}?page=${sec.pageFrom}` : baseHref;
      for (const c of chunkBlogContent(sec.text, label)) {
        collected.push({
          ...c,
          href,
          pageNumber: sec.pageFrom,
          sectionTitle: sec.title,
        });
      }
    }
  }

  // chunkIndex는 소스 단위로 유일해야 하므로 두 갈래를 합친 뒤 다시 매긴다.
  const chunks = collected.map((c, i) => ({ ...c, chunkIndex: i }));
  await replaceChunks("magazine", m.id, baseHref, baseTitle, chunks);
}

// ── 문화예술 이벤트 ──────────────────────────────────────────────────────────
// 발행 이벤트를 서술형 질의용으로 색인(목록/사실은 get_culture_events 도구가 별도 담당).
export async function generateCultureEventEmbeddings(eventId: string): Promise<void> {
  const e = await prisma.cultureEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true, title: true, slug: true, type: true, genre: true, venue: true,
      artists: true, description: true, startDate: true, endDate: true,
      ticketPrice: true, status: true,
    },
  });
  if (!e) return;

  let chunks: { chunkIndex: number; content: string; title: string }[] = [];
  if (e.status === "published") {
    const fmt = (d: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : "";
    const parts = [
      e.title,
      `유형: ${e.type}`,
      e.genre?.length ? `장르: ${e.genre.join(", ")}` : "",
      e.venue ? `장소: ${e.venue}` : "",
      e.artists?.length ? `출연: ${e.artists.join(", ")}` : "",
      `일정: ${fmt(e.startDate)}${e.endDate ? ` ~ ${fmt(e.endDate)}` : ""}`,
      e.ticketPrice ? `가격: ${e.ticketPrice}` : "",
      e.description ?? "",
    ].filter(Boolean);
    const text = parts.join("\n");
    // 설명을 포함해 청킹(짧으면 1청크). chunkBlogContent는 길이<20이면 빈배열 → 보강.
    chunks = chunkBlogContent(`<p>${text}</p>`, e.title);
    if (chunks.length === 0)
      chunks = [{ chunkIndex: 0, content: text, title: e.title }];
  }

  await replaceChunks("culture", e.id, `/culture-events/${e.slug}`, e.title, chunks);
}

// ── 검색 ───────────────────────────────────────────────────────────────────
type RawChunk = ChunkResult;

const SIMILARITY_FLOOR = 0.3; // 코사인 유사도 하한(노이즈 컷)
const RRF_K = 60; // Reciprocal Rank Fusion 상수(관례값)

/** 의미 검색 — 임베딩 코사인 거리. */
async function vectorSearch(query: string, limit: number): Promise<RawChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const vec = `[${queryEmbedding.join(",")}]`;
  const rows = await prisma.$queryRawUnsafe<RawChunk[]>(
    `SELECT "id", "title", "content", "href", "pageNumber", "sectionTitle",
            1 - ("embedding" <=> $1::vector) AS similarity
     FROM "ContentChunk"
     WHERE "embedding" IS NOT NULL
     ORDER BY "embedding" <=> $1::vector
     LIMIT $2`,
    vec,
    limit,
  );
  // 약한 매치는 융합 전에 떨군다(순위만 남으면 노이즈도 점수를 받는다).
  return rows.filter((r) => r.similarity > SIMILARITY_FLOOR);
}

/** 이 비율을 넘는 청크에 걸리는 토큰은 '흔한 말'로 보고 어휘 검색에서 뺀다. */
const COMMON_TOKEN_RATIO = 0.15;

/**
 * 어휘 검색 — pg_trgm word_similarity.
 *
 * 두 가지가 핵심이고 **둘 다 실측으로 정해졌다**(1호 코퍼스 116청크).
 *
 * ① **질의를 토큰으로 쪼갠다.** word_similarity는 첫 인자 전체와 본문의 최적 구간을
 *    비교하므로 문장을 통째로 넣으면 점수가 임계값(0.6)에 못 미쳐 **한 번도 발동하지 않는다**.
 *      "차소용 소프라노는 어떤 역을 맡았어?" → 문장 전체 0.38 / 토큰 "차소용" 1.00
 *
 * ② **흔한 토큰은 뺀다.** 안 그러면 "소프라노는"·"공연" 같은 일반어가 여러 청크에 1.00으로
 *    걸려 상위를 차지하고, 정작 드문 고유명사를 밀어낸다. 문서빈도가 코퍼스의 15%를 넘으면
 *    제외한다(실측에서 "공연"이 33/116 청크에 걸려 제거됨).
 */
async function lexicalSearch(query: string, limit: number): Promise<RawChunk[]> {
  const tokens = [
    ...new Set(
      query
        .replace(/[?!.,·:;"'()[\]{}]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  ].slice(0, 8); // 질의가 길어도 상한
  if (tokens.length === 0) return [];

  try {
    // 문서빈도 계산과 검색을 한 번의 왕복으로 처리한다(토큰마다 질의하면 라운드트립이 늘어난다).
    // `t <% content`는 word_similarity 임계값을 쓰고 GIN 트라이그램 인덱스를 탄다.
    // 청크 점수 = 남은 토큰 중 최고 점수(하나라도 정확히 걸리면 상위로).
    return await prisma.$queryRawUnsafe<RawChunk[]>(
      `WITH tok AS (SELECT DISTINCT t FROM unnest($1::text[]) AS t),
            df AS (
              SELECT tok.t, count(c."id") AS n
                FROM tok LEFT JOIN "ContentChunk" c ON tok.t <% c."content"
               GROUP BY tok.t
            ),
            kept AS (
              -- ::float8 캐스트 필수: count(*)가 bigint라 캐스트가 없으면 $3를 정수로 추론해
              -- "invalid input syntax for type bigint: 0.15"로 실패한다(catch에 삼켜져
              -- 어휘 검색이 조용히 무력화됨).
              SELECT t FROM df
               WHERE n > 0
                 AND n <= greatest(1, (SELECT count(*) FROM "ContentChunk")::float8 * $3::float8)
            )
       SELECT c."id", c."title", c."content", c."href", c."pageNumber", c."sectionTitle",
              max(word_similarity(k.t, c."content")) AS similarity
         FROM "ContentChunk" c, kept k
        WHERE k.t <% c."content"
        GROUP BY c."id", c."title", c."content", c."href", c."pageNumber", c."sectionTitle"
        ORDER BY similarity DESC
        LIMIT $2`,
      tokens,
      limit,
      COMMON_TOKEN_RATIO,
    );
  } catch (err) {
    // pg_trgm 미설치 등 — 어휘 검색이 없어도 의미 검색만으로 동작해야 한다.
    console.error("[RAG] lexical search unavailable:", err);
    return [];
  }
}

/**
 * 하이브리드 검색 = 의미(벡터) + 어휘(트라이그램)를 Reciprocal Rank Fusion으로 융합.
 * 점수 체계가 다른 둘(코사인 vs 트라이그램)을 정규화 없이 **순위만으로** 합치는 방식이라
 * 가중치 튜닝이 필요 없다.
 */
export async function searchChunks(
  query: string,
  topK: number = 5,
): Promise<ChunkResult[]> {
  if (!process.env.GEMINI_API_KEY) return [];

  // 후보 풀을 topK보다 넉넉히 — 융합 후 잘라야 약한 매치에 자리를 뺏기지 않는다.
  const candidates = Math.max(20, topK * 4);
  const [vecRes, lexRes] = await Promise.allSettled([
    vectorSearch(query, candidates),
    lexicalSearch(query, candidates),
  ]);
  if (vecRes.status === "rejected") {
    // 임베딩 호출이 실패해도 어휘 검색만으로 답할 수 있게 한다(전면 실패 방지).
    console.error("[RAG] vector search failed:", vecRes.reason);
  }
  const vec = vecRes.status === "fulfilled" ? vecRes.value : [];
  const lex = lexRes.status === "fulfilled" ? lexRes.value : [];

  const merged = new Map<string, { chunk: ChunkResult; score: number }>();
  for (const list of [vec, lex]) {
    list.forEach((row, i) => {
      const prev = merged.get(row.id);
      const add = 1 / (RRF_K + i + 1);
      if (prev) prev.score += add;
      else merged.set(row.id, { chunk: row, score: add });
    });
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((m) => m.chunk);
}

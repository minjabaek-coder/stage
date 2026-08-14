import { prisma } from "@/lib/prisma";
import { chunkBlogContent } from "@/lib/chunker";
import { embedDocuments, embedQuery } from "@/lib/embeddings";
import sanitizeHtml from "sanitize-html";
import { parsePageLayout, parseHtmlLayout } from "@/types/magazine-layout";
import {
  parseSourceSections,
  pageLabel,
  sectionPages,
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

export async function searchChunks(
  query: string,
  topK: number = 5,
): Promise<ChunkResult[]> {
  if (!process.env.GEMINI_API_KEY) return [];

  const queryEmbedding = await embedQuery(query);
  const vec = `[${queryEmbedding.join(",")}]`;

  // 후보 풀을 topK보다 넉넉히 가져온 뒤 임계값 필터 → topK 슬라이스.
  // (이전엔 DB에서 topK개만 가져와 약한 매치가 섞이면 결과가 줄던 문제)
  const candidates = Math.max(20, topK * 4);
  const rows = await prisma.$queryRawUnsafe<RawChunk[]>(
    `SELECT "id", "title", "content", "href", "pageNumber", "sectionTitle",
            1 - ("embedding" <=> $1::vector) AS similarity
     FROM "ContentChunk"
     WHERE "embedding" IS NOT NULL
     ORDER BY "embedding" <=> $1::vector
     LIMIT $2`,
    vec,
    candidates,
  );

  return rows
    .filter((r) => r.similarity > SIMILARITY_FLOOR)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

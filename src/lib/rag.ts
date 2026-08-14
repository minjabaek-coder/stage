import { prisma } from "@/lib/prisma";
import { chunkBlogContent } from "@/lib/chunker";
import { embedDocuments, embedQuery } from "@/lib/embeddings";
import sanitizeHtml from "sanitize-html";
import { parsePageLayout, parseHtmlLayout } from "@/types/magazine-layout";
import { parseSourceText } from "@/lib/magazine-source-text";

export interface ChunkResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  href: string; // 출처 링크 (/articles/.. | /magazines/.. | /culture-events/..)
}

type SourceType = "article" | "magazine" | "culture";

// 한 소스의 청크를 통째로 갈아끼운다(delete-then-insert). 색인 부적격이면 chunks=[]로
// 호출해 기존 청크만 제거(발행취소·색인제외 반영).
// chunk.href를 주면 그 청크만 다른 출처로 저장한다(매거진 원문 텍스트의 페이지 딥링크).
async function replaceChunks(
  sourceType: SourceType,
  sourceId: string,
  href: string,
  title: string,
  chunks: { chunkIndex: number; content: string; title: string; href?: string }[],
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
         ("id", "sourceType", "sourceId", "chunkIndex", "title", "content", "href", "embedding")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::vector)`,
      sourceType,
      sourceId,
      chunks[i].chunkIndex,
      chunks[i].title || title,
      chunks[i].content,
      chunks[i].href || href,
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
//   ② 매거진 원문 텍스트(sourceText) — 이미지형처럼 페이지에 텍스트가 없는 경우의 코퍼스.
//      `p.12` 마커 구간은 그 페이지 딥링크(`?page=12`)를 출처로 갖는다.
// 두 갈래 모두 articleId 연결 페이지(기사가 발행+색인)는 기사 청크로 커버되므로 제외(중복 방지).
// 비발행/텍스트없음이면 청크 제거.
export async function generateMagazineEmbeddings(magazineId: string): Promise<void> {
  const m = await prisma.magazine.findUnique({
    where: { id: magazineId },
    select: {
      id: true,
      title: true,
      status: true,
      sourceText: true,
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
  const collected: {
    chunkIndex: number;
    content: string;
    title: string;
    href?: string;
  }[] = [];

  if (m.status === "published") {
    // ① 페이지 내장 텍스트
    let combined = "";
    const coveredPages = new Set<number>(); // 기사 청크가 담당하는 페이지(원문 텍스트에서도 제외)
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
    if (combined.trim()) collected.push(...chunkBlogContent(combined, m.title));

    // ② 매거진 원문 텍스트 — 마커 구간별로 제목·출처를 달리 부여
    for (const seg of parseSourceText(m.sourceText)) {
      if (seg.pageNumber !== null && coveredPages.has(seg.pageNumber)) continue;
      const label =
        seg.pageNumber !== null ? `${m.title} · ${seg.pageNumber}p` : m.title;
      const href =
        seg.pageNumber !== null ? `${baseHref}?page=${seg.pageNumber}` : baseHref;
      for (const c of chunkBlogContent(seg.text, label)) {
        collected.push({ ...c, href });
      }
    }
  }

  // chunkIndex는 소스 단위로 유일해야 하므로 두 갈래를 합친 뒤 다시 매긴다.
  const chunks = collected.map((c, i) => ({ ...c, chunkIndex: i }));
  await replaceChunks("magazine", m.id, baseHref, m.title, chunks);
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
type RawChunk = {
  id: string;
  title: string;
  content: string;
  similarity: number;
  href: string;
};

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
    `SELECT "id", "title", "content", "href",
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

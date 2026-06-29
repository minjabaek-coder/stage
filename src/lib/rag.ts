import { prisma } from "@/lib/prisma";
import { chunkBlogContent } from "@/lib/chunker";
import { embedDocuments, embedQuery } from "@/lib/voyage";
import { parsePageLayout } from "@/types/magazine-layout";

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
async function replaceChunks(
  sourceType: SourceType,
  sourceId: string,
  href: string,
  title: string,
  chunks: { chunkIndex: number; content: string; title: string }[],
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
      href,
      vec,
    );
  }
  console.log(`[RAG] ${sourceType} "${title}" → ${chunks.length} chunks`);
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

// ── 매거진 ─────────────────────────────────────────────────────────────────
// 발행 매거진의 구성형 페이지 텍스트 블록을 색인. 단, articleId 연결 페이지는
// 기사 청크로 커버되므로 제외(중복 방지). 비발행/텍스트없음이면 청크 제거.
export async function generateMagazineEmbeddings(magazineId: string): Promise<void> {
  const m = await prisma.magazine.findUnique({
    where: { id: magazineId },
    select: {
      id: true,
      title: true,
      status: true,
      pages: {
        orderBy: { sortOrder: "asc" },
        select: {
          kind: true,
          layout: true,
          // 연결 기사가 "발행+색인"이면 그 텍스트는 기사 청크로 커버 → 매거진에서 제외(중복).
          // 그러나 draft/미색인 기사면 기사 청크에 없으므로 매거진 텍스트로 보존해야 누락이 없다.
          article: { select: { status: true, aiIndexable: true } },
        },
      },
    },
  });
  if (!m) return;

  let combined = "";
  if (m.status === "published") {
    for (const pg of m.pages) {
      if (pg.kind !== "composed") continue;
      const coveredByArticle =
        pg.article?.status === "published" && pg.article?.aiIndexable;
      if (coveredByArticle) continue; // 기사 청크가 이미 담당
      const layout = parsePageLayout(pg.layout);
      if (!layout) continue;
      for (const b of layout.blocks) {
        if (b.type === "text" && b.html) combined += b.html + "\n\n";
      }
    }
  }

  const chunks = combined.trim() ? chunkBlogContent(combined, m.title) : [];
  await replaceChunks("magazine", m.id, `/magazines/${m.id}`, m.title, chunks);
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

export async function searchChunks(
  query: string,
  topK: number = 5,
): Promise<ChunkResult[]> {
  if (!process.env.VOYAGE_API_KEY) return [];

  const queryEmbedding = await embedQuery(query);
  const vec = `[${queryEmbedding.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<RawChunk[]>(
    `SELECT "id", "title", "content", "href",
            1 - ("embedding" <=> $1::vector) AS similarity
     FROM "ContentChunk"
     WHERE "embedding" IS NOT NULL
     ORDER BY "embedding" <=> $1::vector
     LIMIT $2`,
    vec,
    topK,
  );

  return rows
    .filter((r) => r.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

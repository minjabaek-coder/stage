-- 통합 RAG 임베딩 청크 테이블 (pgvector) — 기사/매거진/문화예술 멀티소스
CREATE TABLE IF NOT EXISTS "ContentChunk" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "sourceType"  TEXT NOT NULL,
    "sourceId"    TEXT NOT NULL,
    "chunkIndex"  INTEGER NOT NULL,
    "title"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "href"        TEXT NOT NULL,
    "embedding"   vector(1024),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentChunk_sourceType_sourceId_idx"
    ON "ContentChunk"("sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "ContentChunk_embedding_idx"
    ON "ContentChunk" USING hnsw ("embedding" vector_cosine_ops);

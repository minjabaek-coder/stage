-- 단독 기사 RAG 임베딩 청크 테이블 (pgvector)
CREATE TABLE "ArticleChunk" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "articleId"   TEXT NOT NULL,
    "chunkIndex"  INTEGER NOT NULL,
    "title"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "embedding"   vector(1024),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ArticleChunk_articleId_fkey"
        FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE
);

CREATE INDEX "ArticleChunk_articleId_idx" ON "ArticleChunk"("articleId");

CREATE INDEX "ArticleChunk_embedding_idx" ON "ArticleChunk"
    USING hnsw ("embedding" vector_cosine_ops);

-- 매거진 아티클 RAG 임베딩 청크 테이블 (pgvector)
CREATE TABLE "MagazineArticleChunk" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "articleId"   TEXT NOT NULL,
    "chunkIndex"  INTEGER NOT NULL,
    "title"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "embedding"   vector(1024),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagazineArticleChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MagazineArticleChunk_articleId_fkey"
        FOREIGN KEY ("articleId") REFERENCES "MagazineArticle"("id") ON DELETE CASCADE
);

CREATE INDEX "MagazineArticleChunk_articleId_idx" ON "MagazineArticleChunk"("articleId");

CREATE INDEX "MagazineArticleChunk_embedding_idx" ON "MagazineArticleChunk"
    USING hnsw ("embedding" vector_cosine_ops);

-- Phase A (기사·매거진 모델 병합): MagazineArticle → Article 데이터 이전
-- 운영 DB는 트랜잭션 풀러라 prisma migrate engine 대신 raw SQL로 적용(tsx).
-- 멱등(WHERE NOT EXISTS by id). id·slug 재사용(충돌 없음 사전 확인). 청크 0건이라 복사 불필요.
-- MagazineArticle 테이블/FK는 이 단계에서 유지(롤백 안전). 드롭은 Phase D.
-- 적용: 2026-06-24, 대상 8건(전부 39호 draft).

INSERT INTO "Article"
  (id, title, slug, excerpt, content, author, category, genre, "subCategory", tags,
   "thumbnailUrl", "isFeatured", "isPremium", "aiIndexable", "viewCount", status,
   "publishedAt", "createdAt", "updatedAt")
SELECT ma.id, ma.title, ma.slug, NULL, ma.content, ma.author,
       COALESCE(ma."subCategory", ''), ma.genre, ma."subCategory", '{}'::text[],
       ma."thumbnailUrl", false, false, true, 0, ma.status,
       ma."publishedAt", ma."createdAt", ma."updatedAt"
FROM "MagazineArticle" ma
WHERE NOT EXISTS (SELECT 1 FROM "Article" a WHERE a.id = ma.id);

-- 참고: 매거진기사 청크가 있었다면 아래로 ArticleChunk 이전(현재 0건이라 미실행):
-- INSERT INTO "ArticleChunk" (id, "articleId", "chunkIndex", title, content, embedding, "createdAt")
-- SELECT c.id, c."articleId", c."chunkIndex", c.title, c.content, c.embedding, c."createdAt"
-- FROM "MagazineArticleChunk" c
-- WHERE NOT EXISTS (SELECT 1 FROM "ArticleChunk" a WHERE a.id = c.id);

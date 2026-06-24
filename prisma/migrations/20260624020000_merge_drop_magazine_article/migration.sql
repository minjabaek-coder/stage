-- 기사·매거진 병합 Phase D: MagazinePage.articleId FK를 Article로 전환 후
-- 레거시 MagazineArticle·MagazineArticleChunk 테이블 드롭.
-- (데이터는 Phase A에서 Article로 이전 완료. 9개 페이지 링크 orphan 0 확인.)
-- 운영 풀러 대응 raw SQL(tsx) 적용 + _prisma_migrations 체크섬 등록.

ALTER TABLE "MagazinePage" DROP CONSTRAINT IF EXISTS "MagazinePage_articleId_fkey";
ALTER TABLE "MagazinePage" ADD CONSTRAINT "MagazinePage_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "MagazineArticleChunk";
DROP TABLE IF EXISTS "MagazineArticle";

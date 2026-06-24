-- 매거진 기사 택소노미: 대분류(genre) / 소분류(subCategory) 추가 — Article과 일관.
-- section(뷰어 라벨)은 유지. 추가형·NULL 허용이라 무손실. (풀러 대응 멱등 작성)

ALTER TABLE "MagazineArticle" ADD COLUMN IF NOT EXISTS "genre" TEXT;
ALTER TABLE "MagazineArticle" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;

CREATE INDEX IF NOT EXISTS "MagazineArticle_genre_idx" ON "MagazineArticle"("genre");

-- 백필: section이 유형 고정목록과 일치하면 subCategory로
UPDATE "MagazineArticle"
SET "subCategory" = "section"
WHERE "subCategory" IS NULL
  AND "section" IN ('리뷰','프리뷰','인터뷰','공연소식','전시소식','칼럼','에세이','현장스케치','기획');

-- 백필: section이 장르 고정목록과 일치하면 genre로
UPDATE "MagazineArticle"
SET "genre" = "section"
WHERE "genre" IS NULL
  AND "section" IN ('클래식','오페라','무용','연극','뮤지컬','국악','전시','교육');

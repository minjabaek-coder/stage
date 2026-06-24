-- 기사 택소노미: 대분류(genre) / 소분류(subCategory) 전용 필드 추가
-- 기존 category(자유입력)·tags(장르 근사)에서 백필. 추가형·NULL 허용이라 무손실.
-- (운영 DB는 트랜잭션 풀러라 prisma migrate engine 대신 raw SQL로 적용 후 등록 — 멱등 작성)

ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "genre" TEXT;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;

CREATE INDEX IF NOT EXISTS "Article_genre_idx" ON "Article"("genre");

-- 소분류 백필: 기존 category(자유입력값: 리뷰·인터뷰 등)를 subCategory로 이전
UPDATE "Article"
SET "subCategory" = "category"
WHERE "category" IS NOT NULL AND "category" <> '' AND "subCategory" IS NULL;

-- 대분류 백필: tags 배열에서 알려진 장르값 첫 항목을 genre로 이전
UPDATE "Article" a
SET "genre" = (
  SELECT t.tag
  FROM unnest(a.tags) AS t(tag)
  WHERE t.tag IN ('클래식','오페라','무용','연극','뮤지컬','국악','전시','교육')
  LIMIT 1
)
WHERE a."genre" IS NULL;

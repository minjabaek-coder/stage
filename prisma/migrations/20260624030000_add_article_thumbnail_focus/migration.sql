-- 기사 썸네일 비파괴 크롭(초점+줌) 필드. 추가형·NULL 허용이라 무손실.
-- null = 기본(초점 50/50, 줌 1×). 운영 풀러 대응 raw SQL(tsx) 적용 + 체크섬 등록.

ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "thumbnailFocusX" DOUBLE PRECISION;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "thumbnailFocusY" DOUBLE PRECISION;
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "thumbnailZoom" DOUBLE PRECISION;

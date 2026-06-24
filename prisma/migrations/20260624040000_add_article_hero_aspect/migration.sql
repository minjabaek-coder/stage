-- 기사 상세 히어로 비율 프리셋(wide/standard/tall). 추가형·NULL 허용 무손실.
-- null = 기본(standard 16:9). 운영 풀러 대응 raw SQL(tsx) 적용 + 체크섬 등록.

ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "heroAspect" TEXT;

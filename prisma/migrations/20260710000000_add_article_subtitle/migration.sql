-- 기사 부제(deck) 컬럼 추가
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;

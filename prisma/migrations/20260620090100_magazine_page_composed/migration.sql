-- 39호+ 구성형 페이지 지원 (추가형).
DO $$ BEGIN
  CREATE TYPE "MagazinePageKind" AS ENUM ('image', 'composed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "MagazinePage" ADD COLUMN IF NOT EXISTS "kind" "MagazinePageKind" NOT NULL DEFAULT 'image';
ALTER TABLE "MagazinePage" ADD COLUMN IF NOT EXISTS "layout" JSONB;
ALTER TABLE "MagazinePage" ADD COLUMN IF NOT EXISTS "articleId" TEXT;
ALTER TABLE "MagazinePage" ALTER COLUMN "imageUrl" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "MagazinePage" ADD CONSTRAINT "MagazinePage_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "MagazineArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "MagazinePage_articleId_idx" ON "MagazinePage"("articleId");

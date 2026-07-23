-- 매거진 미디어 라이브러리: kind=html 페이지용 업로드 이미지(매거진 단위).
-- 재사용·사용처추적·삭제 관리를 위해 페이지가 아닌 매거진에 소속. 상세 docs/design/magazine-html-page.md.
-- 멱등(IF NOT EXISTS / 중복 FK 무시)으로 재실행 안전.
CREATE TABLE IF NOT EXISTS "MagazineAsset" (
    "id" TEXT NOT NULL,
    "magazineId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MagazineAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MagazineAsset_magazineId_idx" ON "MagazineAsset"("magazineId");

DO $$ BEGIN
    ALTER TABLE "MagazineAsset"
        ADD CONSTRAINT "MagazineAsset_magazineId_fkey"
        FOREIGN KEY ("magazineId") REFERENCES "Magazine"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 매거진 원문을 "마커 박힌 평문"에서 **구간 구조**로 전환.
-- 본문 안의 `p.12` 마커는 in-band signaling이라 "p. 45"(인용)·"3쪽"(캡션) 같은 본문 줄과
-- 원리적으로 구분되지 않고, 색인 때마다 재파싱되어 해석이 흔들린다. 페이지 귀속을 구조로
-- 옮겨 임포트 시 1회만 파싱(사람 확인)하게 한다. 상세 docs/decisions/0007-source-sections.md.
--
-- ContentChunk에는 페이지·구간제목을 메타데이터 컬럼으로 둔다(기존엔 href 문자열에만 존재).
-- 멱등(IF NOT EXISTS)으로 재실행 안전.

ALTER TABLE "Magazine" ADD COLUMN IF NOT EXISTS "sourceSections" JSONB;

ALTER TABLE "ContentChunk" ADD COLUMN IF NOT EXISTS "pageNumber" INTEGER;
ALTER TABLE "ContentChunk" ADD COLUMN IF NOT EXISTS "sectionTitle" TEXT;

-- 기존 sourceText가 있으면 페이지 미지정 단일 구간으로 이전(적용 시점 대상 0건이지만
-- 마이그레이션이 데이터 스냅샷에 의존하지 않도록 포함). sourceText 컬럼 자체는 남겨
-- "마지막 임포트 원문 아카이브"로 쓰되 색인에서는 읽지 않는다.
UPDATE "Magazine"
   SET "sourceSections" = jsonb_build_array(
         jsonb_build_object(
           'id', 'imported',
           'pageFrom', NULL,
           'pageTo', NULL,
           'title', NULL,
           'text', "sourceText"
         )
       )
 WHERE "sourceText" IS NOT NULL
   AND btrim("sourceText") <> ''
   AND "sourceSections" IS NULL;

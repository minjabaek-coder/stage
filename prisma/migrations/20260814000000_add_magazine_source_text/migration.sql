-- 매거진 원문 텍스트(sourceText): 이미지형 매거진처럼 페이지 자체에 텍스트가 없어
-- RAG 코퍼스가 비는 경우를 메우기 위한 매거진 단위 텍스트. 본문 중 `p.12` 형태의
-- 페이지 마커로 구간을 나누면 청크가 해당 페이지로 귀속되어 출처가 딥링크된다.
-- 상세 docs/design/magazine.md §D · docs/decisions/0006-magazine-source-text.md.
-- 멱등(IF NOT EXISTS)으로 재실행 안전.
ALTER TABLE "Magazine" ADD COLUMN IF NOT EXISTS "sourceText" TEXT;
ALTER TABLE "Magazine" ADD COLUMN IF NOT EXISTS "sourceTextUpdatedAt" TIMESTAMP(3);

-- 하이브리드 검색용 트라이그램 인덱스 (roadmap S1-4 / BL-2).
--
-- 벡터 검색만으로는 고유명사에 약하다 — 'K&L ARTS'·인명·공연장명처럼 드문 토큰은
-- 임베딩 공간에서 흐려진다. pg_trgm의 word_similarity로 어휘 검색을 겹친다.
--
-- 왜 similarity가 아니라 word_similarity인가(실측):
--   similarity(content, '광림아트센터')      = 0.02   ← 긴 본문과 짧은 질의를 통째로 비교해 무용
--   word_similarity('광림아트센터', content) = 1.00   ← 본문 안 최적 구간과 비교
--
-- 멱등(IF NOT EXISTS)으로 재실행 안전. 확장은 search_path에 있는 public에 설치된다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ContentChunk_content_trgm_idx"
  ON "ContentChunk" USING gin (content gin_trgm_ops);

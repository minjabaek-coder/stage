-- 게스트 AI 질문 한도의 서버 측 카운터 (roadmap S0-2 / BL-10).
-- 기존 한도는 클라이언트가 보내는 sessionId 하나로만 세어 localStorage를 지우면 초기화됐다.
--
-- 개인정보 최소화: 대화 내용(AiInteraction)과 **분리된 전용 테이블**이며, 저장하는 값은
-- "어떤 익명 버킷이 오늘 몇 번"이라는 숫자뿐이다. keyHash는 날짜별로 교체되는 솔트로
-- 만든 HMAC이라 날짜가 바뀌면 같은 IP도 다른 값이 된다. 지난 날짜 행은 기록 시 삭제되어
-- 보유기간이 구조적으로 '당일'로 제한된다. 원본 IP는 저장·로깅하지 않는다.
--
-- 멱등(IF NOT EXISTS)으로 재실행 안전.
CREATE TABLE IF NOT EXISTS "AiRateLimit" (
    "keyHash"   TEXT NOT NULL,
    "day"       TEXT NOT NULL,
    "count"     INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiRateLimit_pkey" PRIMARY KEY ("keyHash", "day")
);

CREATE INDEX IF NOT EXISTS "AiRateLimit_day_idx" ON "AiRateLimit"("day");

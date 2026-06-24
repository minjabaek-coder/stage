-- 사이트 전역 설정 키-값 저장소 (StageOS 배너 등 어드민 설정형 항목)
CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

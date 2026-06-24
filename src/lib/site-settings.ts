import { prisma } from "@/lib/prisma";

// StageOS 프로모 배너 설정형 항목 (어드민 /admin/settings 에서 수정)
export type StageOsBannerConfig = {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  ctaLabel: string;
  ctaHref: string;
};

// 기본값(=기존 하드코딩 카피). DB 행이 없거나 일부 키 누락 시 fallback.
export const STAGEOS_BANNER_DEFAULT: StageOsBannerConfig = {
  enabled: true,
  eyebrow: "Coming Soon · StageOS",
  headline:
    "문화예술 기관을 위한 AI 운영 플랫폼 — 모바일 브로셔 · 음성 해설 · 관객 분석 · AI 마에스트로 API",
  ctaLabel: "얼리 액세스 신청 →",
  ctaHref: "/stageos",
};

const STAGEOS_KEY = "stageos_banner";

export async function getStageOsBanner(): Promise<StageOsBannerConfig> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: STAGEOS_KEY },
  });
  if (!row) return STAGEOS_BANNER_DEFAULT;
  // 부분 누락 키는 기본값으로 보강
  return {
    ...STAGEOS_BANNER_DEFAULT,
    ...(row.value as Partial<StageOsBannerConfig>),
  };
}

export async function setStageOsBanner(config: StageOsBannerConfig) {
  await prisma.siteSetting.upsert({
    where: { key: STAGEOS_KEY },
    create: { key: STAGEOS_KEY, value: config },
    update: { value: config },
  });
}

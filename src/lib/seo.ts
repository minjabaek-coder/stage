// 사이트 전역 SEO 상수. 프로덕션 도메인 기준(canonical/OG는 항상 정식 도메인).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bon-stage.com";

export const SITE_NAME = "STAGE";

export const SITE_TITLE = "STAGE — 문화예술 디지털 매거진";

export const SITE_DESCRIPTION =
  "클래식·공연·전시 등 무대 위 예술을 깊이 있게 담는 문화예술 디지털 매거진. AI 도슨트 마에스트로와 함께 읽는 STAGE.";

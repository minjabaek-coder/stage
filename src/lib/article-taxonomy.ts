// 기사 택소노미 — 대분류(genre, 예술 장르) / 소분류(subCategory, 콘텐츠 형식).
// 목록 장르 내비·필터·어드민 폼·카드가 공유하는 단일 출처.

/** 대분류(예술 장르). genre-sub-nav·필터·어드민 드롭다운 공유. */
export const ARTICLE_GENRES = [
  "클래식",
  "오페라",
  "무용",
  "연극",
  "뮤지컬",
  "국악",
  "전시",
  "교육",
] as const;

/** 소분류(콘텐츠 형식). 고정 제안 목록 + 어드민에서 직접입력 허용. */
export const ARTICLE_SUBCATEGORIES = [
  "리뷰",
  "프리뷰",
  "인터뷰",
  "공연소식",
  "전시소식",
  "칼럼",
  "에세이",
  "현장스케치",
  "기획",
] as const;

export type ArticleGenre = (typeof ARTICLE_GENRES)[number];
export type ArticleSubCategory = (typeof ARTICLE_SUBCATEGORIES)[number];

export function isArticleGenre(v: string): v is ArticleGenre {
  return (ARTICLE_GENRES as readonly string[]).includes(v);
}

// 기사 상세 히어로 비율 프리셋 — 어드민 선택 + 상세 렌더 + 어드민 미리보기 공유.
export const ARTICLE_HERO_ASPECTS = [
  { key: "wide", label: "와이드 (21:9)", ratio: "21 / 9" },
  { key: "standard", label: "표준 (16:9)", ratio: "16 / 9" },
  { key: "tall", label: "톨 (3:2)", ratio: "3 / 2" },
] as const;

export const DEFAULT_HERO_ASPECT = "standard";

/** heroAspect 키 → CSS aspect-ratio 값(미지정/미일치는 표준 16:9). */
export function heroAspectRatio(key: string | null | undefined): string {
  return (
    ARTICLE_HERO_ASPECTS.find((a) => a.key === key)?.ratio ?? "16 / 9"
  );
}

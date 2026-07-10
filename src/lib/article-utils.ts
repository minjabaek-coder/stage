// 기사 공용 유틸 — 슬러그/태그 처리. 서버 액션·어드민 폼이 공유(중복 제거).

/** 제목 → URL 슬러그(영문·숫자·하이픈). 한글 등은 제거되어 빈 문자열이 될 수 있음. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[가-힣]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 슬러그를 만들 수 없을 때의 자동 발급값. */
export function randomSlug(): string {
  return `article-${Math.random().toString(36).slice(2, 10)}`;
}

/** 콤마 구분 문자열 → 태그 배열(공백 제거·빈값 제외). */
export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

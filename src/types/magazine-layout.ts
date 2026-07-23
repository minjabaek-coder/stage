// 39호+ 구성형 페이지 레이아웃 스펙. MagazinePage.layout(JSONB)에 저장.
// 좌표/크기는 2:3 페이지 기준 % (0~100). 글자 크기는 px(기준 폭 440에서) — 뷰어는
// container query(cqw)로 비례 환산해 썸네일~전체화면 어디서나 일관 렌더.

export type BlockBase = {
  id: string;
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
  z: number;
  rotation?: number; // deg
  opacity?: number; // 0~1
  groupId?: string; // P2: 평면 그룹 태그(트리 아님 → 뷰어 무변경). 같은 groupId끼리 함께 선택/이동
  locked?: boolean; // P5: 잠금(편집기에서 선택/이동 불가). 뷰어는 무시
  hidden?: boolean; // P5: 편집기에서 숨김(작업 편의). 뷰어는 무시(항상 렌더)
};

export type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  fit?: "cover" | "contain"; // 채우기(크롭) | 원본비율
  focusX?: number; // 0~100 (크롭 초점)
  focusY?: number;
  zoom?: number; // 채우기 시 확대 배율(>=1, 기본 1) — 초점 기준으로 더 당겨 보기
  radius?: number; // px
  overlayDarken?: number; // 0~90 (%)
};

export type TextBlock = BlockBase & {
  type: "text";
  html: string; // 정제된 리치텍스트
  color?: string;
  fontSizePx?: number; // 기준 폭 440 기준
  align?: "left" | "center" | "right";
  weight?: number;
  lineHeight?: number;
  bgColor?: string;
  padding?: number; // px
  wordBreak?: "keep-all" | "normal"; // 한글 줄바꿈(keep-all=어절 경계 유지). 자동초안 기본 keep-all
};

export type ShapeBlock = BlockBase & {
  type: "shape";
  shape: "rect" | "ellipse" | "line" | "triangle" | "diamond";
  fill?: string; // 색 또는 그라데이션 문자열
  stroke?: string; // 테두리/선 색
  strokeWidth?: number; // px
  radius?: number; // px (rect 모서리)
};

export type Block = ImageBlock | TextBlock | ShapeBlock;

export type PageLayout = {
  blocks: Block[];
  pageBg?: string; // 페이지 바탕색 (기본 흰색)
};

// kind=html 페이지: 페이지 전체 HTML(iframe sandbox 렌더). MagazinePage.layout에 { html } 저장.
export type HtmlLayout = { html: string };

// 레이아웃 설계 기준 페이지 폭(px). 글자 크기 cqw 환산에 사용.
export const LAYOUT_BASE_WIDTH = 440;

// JSONB → PageLayout 안전 파싱
export function parsePageLayout(raw: unknown): PageLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { blocks?: unknown; pageBg?: unknown };
  if (!Array.isArray(obj.blocks)) return null;
  const blocks = obj.blocks.filter(
    (b): b is Block =>
      !!b &&
      typeof b === "object" &&
      (((b as Block).type === "image" && typeof (b as ImageBlock).src === "string") ||
        ((b as Block).type === "text" && typeof (b as TextBlock).html === "string") ||
        ((b as Block).type === "shape" && typeof (b as ShapeBlock).shape === "string"))
  );
  return { blocks, pageBg: typeof obj.pageBg === "string" ? obj.pageBg : undefined };
}

// kind=html 페이지의 layout({ html }) 안전 파싱.
export function parseHtmlLayout(raw: unknown): HtmlLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const html = (raw as { html?: unknown }).html;
  return typeof html === "string" ? { html } : null;
}

// P3-② 용량 휴리스틱 + ③ 페이지 블록 템플릿.
// 고정 2:3 캔버스(440×660, LAYOUT_BASE_WIDTH). 결정: 보수적(K=1.05, 채움 0.85, lineHeight 1.6).
import type { Block, PageLayout, TextBlock, ImageBlock } from "@/types/magazine-layout";

const BASE_W = 440;
const BASE_H = 660;

// 튜닝 상수(추후 실측 조정) — 보수적 기본값.
export const FIT = { K: 1.05, lineHeight: 1.6, fill: 0.85 } as const;

const uid = () => "b" + Math.random().toString(36).slice(2, 9);

// 텍스트 블록(폭·높이 %, 폰트px)에 들어갈 대략 글자수(보수적).
export function textCapacity(
  wPct: number,
  hPct: number,
  fontSizePx: number,
  lineHeight: number = FIT.lineHeight,
): number {
  const wpx = (wPct / 100) * BASE_W;
  const hpx = (hPct / 100) * BASE_H;
  const charsPerLine = Math.max(1, Math.floor(wpx / (fontSizePx * FIT.K)));
  const lines = Math.max(1, Math.floor(hpx / (fontSizePx * lineHeight)));
  return Math.floor(charsPerLine * lines * FIT.fill);
}

// ── 팔레트(기존 프리셋과 통일) ───────────────────────────────
const INK = "#1c1b1b";
const MUTED = "#3f3a33";
const GOLD = "#6f5c24";
const PAPER = "#fbf8f3";

function t(
  partial: Omit<TextBlock, "id" | "type" | "z">,
  z: number,
): TextBlock {
  return { id: uid(), type: "text", z, ...partial };
}
function img(
  partial: Omit<ImageBlock, "id" | "type" | "z">,
  z: number,
): ImageBlock {
  return { id: uid(), type: "image", z, ...partial };
}

// 본문 텍스트 블록의 표준 사양(제목 유무에 따라 위치·높이 다름).
export const BODY = { x: 8, w: 84, fontSizePx: 11, lineHeight: 1.7 } as const;
const BODY_TOP_WITH_HEADING = { y: 22, h: 70 };
const BODY_TOP_NO_HEADING = { y: 8, h: 84 };

export function bodyCapacity(withHeading: boolean): number {
  const b = withHeading ? BODY_TOP_WITH_HEADING : BODY_TOP_NO_HEADING;
  return textCapacity(BODY.w, b.h, BODY.fontSizePx, BODY.lineHeight);
}

// ── 페이지 템플릿(콘텐츠 → PageLayout) ───────────────────────

// 표지/리드: 상단 히어로 이미지 + 제목 + 부제 + 바이라인 + 리드 문단.
export function coverPage(opts: {
  title: string;
  subtitle?: string;
  byline?: string;
  heroSrc?: string;
  leadHtml?: string;
}): PageLayout {
  const blocks: Block[] = [];
  if (opts.heroSrc) {
    blocks.push(img({ x: 0, y: 0, w: 100, h: 46, src: opts.heroSrc, fit: "cover" }, 1));
  }
  const top = opts.heroSrc ? 52 : 14;
  if (opts.subtitle)
    blocks.push(t({ x: 8, y: top, w: 84, h: 6, html: esc(opts.subtitle), color: GOLD, fontSizePx: 12, weight: 500 }, 2));
  blocks.push(t({ x: 8, y: top + 6, w: 84, h: 16, html: esc(opts.title), color: INK, fontSizePx: 32, weight: 900, lineHeight: 1.15 }, 3));
  if (opts.byline)
    blocks.push(t({ x: 8, y: top + 24, w: 84, h: 5, html: esc(opts.byline), color: MUTED, fontSizePx: 11, weight: 500 }, 4));
  if (opts.leadHtml)
    blocks.push(t({ x: 8, y: top + 31, w: 84, h: 24, html: opts.leadHtml, color: MUTED, fontSizePx: 12, lineHeight: 1.8 }, 5));
  return { pageBg: PAPER, blocks };
}

// 본문 페이지: (선택) 섹션 제목 + 본문 텍스트.
export function bodyPage(opts: { heading?: string; bodyHtml: string }): PageLayout {
  const blocks: Block[] = [];
  let z = 1;
  if (opts.heading) {
    blocks.push(t({ x: BODY.x, y: 8, w: BODY.w, h: 10, html: esc(opts.heading), color: INK, fontSizePx: 20, weight: 900, lineHeight: 1.25 }, z++));
  }
  const b = opts.heading ? BODY_TOP_WITH_HEADING : BODY_TOP_NO_HEADING;
  blocks.push(t({ x: BODY.x, y: b.y, w: BODY.w, h: b.h, html: opts.bodyHtml, color: MUTED, fontSizePx: BODY.fontSizePx, lineHeight: BODY.lineHeight }, z++));
  return { pageBg: "#ffffff", blocks };
}

// 사진 + 본문(하이브리드 인라인 이미지): 상단 이미지 + 캡션 + 하단 본문.
export const IMGTEXT_BODY = { x: 8, y: 60, w: 84, h: 32, fontSizePx: 11, lineHeight: 1.7 };
export function imageTextPage(opts: { src: string; caption?: string; bodyHtml?: string }): PageLayout {
  const blocks: Block[] = [
    img({ x: 0, y: 0, w: 100, h: 52, src: opts.src, fit: "cover" }, 1),
  ];
  if (opts.caption)
    blocks.push(t({ x: 8, y: 53, w: 84, h: 5, html: esc(opts.caption), color: GOLD, fontSizePx: 10, weight: 500 }, 2));
  if (opts.bodyHtml)
    blocks.push(t({ x: IMGTEXT_BODY.x, y: IMGTEXT_BODY.y, w: IMGTEXT_BODY.w, h: IMGTEXT_BODY.h, html: opts.bodyHtml, color: MUTED, fontSizePx: IMGTEXT_BODY.fontSizePx, lineHeight: IMGTEXT_BODY.lineHeight }, 3));
  return { pageBg: "#ffffff", blocks };
}

// 풀 이미지 + 캡션.
export function fullImagePage(opts: { src: string; caption?: string }): PageLayout {
  const blocks: Block[] = [
    img({ x: 0, y: 0, w: 100, h: opts.caption ? 88 : 100, src: opts.src, fit: "cover" }, 1),
  ];
  if (opts.caption)
    blocks.push(t({ x: 8, y: 90, w: 84, h: 6, html: esc(opts.caption), color: GOLD, fontSizePx: 11, weight: 500 }, 2));
  return { pageBg: "#000000", blocks };
}

// 갤러리: 한 행에 N장 나란히 + 각 캡션.
export function galleryPage(images: { src: string; caption?: string }[]): PageLayout {
  const n = Math.max(1, images.length);
  const gap = 1.5;
  const w = (100 - gap * (n + 1)) / n;
  const blocks: Block[] = [];
  images.forEach((im, i) => {
    const x = gap + i * (w + gap);
    blocks.push(img({ x, y: 30, w, h: 34, src: im.src, fit: "cover" }, i * 2 + 1));
    if (im.caption)
      blocks.push(t({ x, y: 65, w, h: 6, html: esc(im.caption), color: GOLD, fontSizePx: 9, align: "center" }, i * 2 + 2));
  });
  return { pageBg: "#ffffff", blocks };
}

// 텍스트 블록 html에 넣을 문자열 이스케이프(제목·캡션 등 평문용).
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

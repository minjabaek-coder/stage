import type { PageLayout } from "@/types/magazine-layout";

// 구성형 페이지 레이아웃 프리셋(코드 상수, DB 불필요).
// % 좌표라 위치 독립, fontSizePx는 기준폭 440 기준. build()마다 새 블록 id 발급.
const uid = () => "b" + Math.random().toString(36).slice(2, 9);

export type PagePreset = {
  id: string;
  name: string;
  build: () => PageLayout;
};

export const PAGE_PRESETS: PagePreset[] = [
  {
    id: "cover",
    name: "표지형",
    build: () => ({
      pageBg: "#fbf8f3",
      blocks: [
        { id: uid(), type: "shape", shape: "rect", x: 0, y: 0, w: 100, h: 46, z: 1, fill: "#241f1c" },
        { id: uid(), type: "text", x: 10, y: 54, w: 80, h: 6, z: 2, html: "COVER STORY", color: "#6f5c24", fontSizePx: 11, weight: 500, align: "left" },
        { id: uid(), type: "text", x: 10, y: 60, w: 80, h: 16, z: 3, html: "제목을 입력하세요", color: "#1c1b1b", fontSizePx: 34, weight: 900, lineHeight: 1.15 },
        { id: uid(), type: "text", x: 10, y: 82, w: 80, h: 10, z: 4, html: "부제 또는 리드 문장을 입력하세요.", color: "#444748", fontSizePx: 13, lineHeight: 1.7 },
      ],
    }),
  },
  {
    id: "photo-caption",
    name: "풀사진 + 캡션",
    build: () => ({
      pageBg: "#ffffff",
      blocks: [
        { id: uid(), type: "image", x: 0, y: 0, w: 100, h: 68, z: 1, src: "", fit: "cover" },
        { id: uid(), type: "text", x: 8, y: 72, w: 84, h: 6, z: 2, html: "CAPTION", color: "#6f5c24", fontSizePx: 10, weight: 500 },
        { id: uid(), type: "text", x: 8, y: 78, w: 84, h: 9, z: 3, html: "사진 제목 / 설명", color: "#1c1b1b", fontSizePx: 18, weight: 700, lineHeight: 1.3 },
      ],
    }),
  },
  {
    id: "article",
    name: "제목 + 본문",
    build: () => ({
      pageBg: "#ffffff",
      blocks: [
        { id: uid(), type: "text", x: 8, y: 8, w: 84, h: 5, z: 1, html: "REVIEW", color: "#6f5c24", fontSizePx: 10, weight: 500 },
        { id: uid(), type: "text", x: 8, y: 14, w: 84, h: 10, z: 2, html: "기사 제목을 입력하세요", color: "#1c1b1b", fontSizePx: 24, weight: 900, lineHeight: 1.25 },
        { id: uid(), type: "text", x: 8, y: 28, w: 84, h: 64, z: 3, html: "본문을 입력하세요. 여러 문단을 작성할 수 있습니다.", color: "#3f3a33", fontSizePx: 11, lineHeight: 1.8 },
      ],
    }),
  },
  {
    id: "two-column",
    name: "2단 본문",
    build: () => ({
      pageBg: "#ffffff",
      blocks: [
        { id: uid(), type: "text", x: 8, y: 10, w: 84, h: 9, z: 1, html: "제목을 입력하세요", color: "#1c1b1b", fontSizePx: 22, weight: 900, lineHeight: 1.25 },
        { id: uid(), type: "text", x: 8, y: 24, w: 40, h: 68, z: 2, html: "왼쪽 단 본문입니다.", color: "#3f3a33", fontSizePx: 10, lineHeight: 1.8 },
        { id: uid(), type: "text", x: 52, y: 24, w: 40, h: 68, z: 3, html: "오른쪽 단 본문입니다.", color: "#3f3a33", fontSizePx: 10, lineHeight: 1.8 },
      ],
    }),
  },
  {
    id: "image-text",
    name: "사진 + 본문(좌우)",
    build: () => ({
      pageBg: "#ffffff",
      blocks: [
        { id: uid(), type: "image", x: 0, y: 0, w: 48, h: 100, z: 1, src: "", fit: "cover" },
        { id: uid(), type: "text", x: 54, y: 12, w: 40, h: 8, z: 2, html: "제목", color: "#1c1b1b", fontSizePx: 20, weight: 900, lineHeight: 1.25 },
        { id: uid(), type: "text", x: 54, y: 24, w: 40, h: 66, z: 3, html: "본문을 입력하세요.", color: "#3f3a33", fontSizePx: 10, lineHeight: 1.8 },
      ],
    }),
  },
];

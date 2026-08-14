// 매거진 원문 텍스트(Magazine.sourceText) 파서.
//
// 이미지형 매거진은 페이지가 비트맵이라 RAG에 넣을 텍스트가 없다. 그렇다고 페이지마다
// 텍스트를 따로 입력받으면 수십 쪽×수십 호를 일일이 다뤄야 한다. 그래서 매거진 단위로
// 텍스트 한 덩어리를 받되, 본문 안의 "페이지 마커" 줄로 구간을 나눠 페이지 귀속을 얻는다.
//   - 마커가 있는 구간 → 그 페이지 소속. 청크 출처가 `/magazines/{id}?page=N`으로 딥링크된다.
//   - 마커가 없으면    → 매거진 전체 소속(단일 구간). 마커는 어디까지나 선택 사항.
//
// 서버(rag.ts 색인)와 클라이언트(어드민 카드의 마커 미리보기)가 함께 쓰므로
// 외부 의존성 없는 순수 모듈로 유지한다.

export type SourceSegment = {
  /** 이 구간이 속한 페이지 번호. 마커 앞(또는 마커 없음)이면 null = 매거진 전체 소속. */
  pageNumber: number | null;
  text: string;
};

// 마커 줄 주변에 흔히 붙는 장식 문자(구분선·머리표·괄호)와 공백.
const DECO = "[-–—=*#·・~_\\[\\]<>(){}\\s]";

// 줄 전체가 페이지 표기일 때만 마커로 본다(본문 중간의 "12페이지에서 보듯"은 걸리지 않음).
// 허용: p.12 · P 12 · page 12 · pp.12 · 12p · 12페이지 · 12쪽 · 페이지 12 · --- p.12 --- · p.12-13
const PAGE_MARKER_RE = new RegExp(
  `^${DECO}*(?:` +
    `(?:page|pp|pg|p|페이지|쪽)\\s*\\.?\\s*(\\d{1,4})` + // p.12 / page 12 / 페이지 12
    `|(\\d{1,4})\\s*(?:page|pp|pg|p|페이지|쪽)` + // 12p / 12페이지 / 12쪽
    `)(?:\\s*[-–—~]\\s*\\d{1,4})?${DECO}*$`, // p.12-13 → 시작 페이지(12)에 귀속
  "i",
);

/** 줄이 페이지 마커면 페이지 번호, 아니면 null. */
export function matchPageMarker(line: string): number | null {
  const m = line.match(PAGE_MARKER_RE);
  if (!m) return null;
  const n = Number(m[1] ?? m[2]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 원문 텍스트를 페이지 마커 기준 구간으로 분해한다. 마커 줄 자체는 본문에서 제외된다. */
export function parseSourceText(raw: string | null | undefined): SourceSegment[] {
  if (!raw || !raw.trim()) return [];

  const segments: SourceSegment[] = [];
  let pageNumber: number | null = null;
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) segments.push({ pageNumber, text });
    buf = [];
  };

  for (const line of raw.split(/\r?\n/)) {
    const marker = matchPageMarker(line);
    if (marker !== null) {
      flush();
      pageNumber = marker;
    } else {
      buf.push(line);
    }
  }
  flush();

  return segments;
}

/** 어드민 UI 표시용 요약(글자 수 · 인식된 마커 수 · 페이지 목록). */
export function summarizeSourceText(raw: string | null | undefined) {
  const segments = parseSourceText(raw);
  const pages = segments
    .map((s) => s.pageNumber)
    .filter((n): n is number => n !== null);
  return {
    chars: (raw ?? "").length,
    segments: segments.length,
    pages: [...new Set(pages)].sort((a, b) => a - b),
    hasUnmarkedIntro: segments.some((s) => s.pageNumber === null),
  };
}

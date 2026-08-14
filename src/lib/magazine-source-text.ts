// 붙여넣은 원문 텍스트 → 구간 초안(SourceSection[]) 변환기. **임포트 시 1회만** 쓴다.
//
// ⚠️ 이 파서는 정본이 아니다. 본문 안의 `p.12` 같은 페이지 마커는 in-band signaling이라
// "p. 45"(인용 출처)·"3쪽"(캡션)처럼 본문에 자연히 등장하는 줄과 원리적으로 구분되지 않는다.
// 그래서 여기서 나온 결과는 **어드민이 미리보기로 확인·수정한 뒤 구조(Magazine.sourceSections)로
// 저장**되고, 색인은 그 구조만 읽는다. 저장된 텍스트를 다시 파싱하는 경로는 없다
// (같은 텍스트가 나중에 다르게 해석되는 일을 막기 위함). 상세 docs/decisions/0007.
//
// 클라이언트(임포트 패널)에서만 쓰이지만 외부 의존성 없는 순수 모듈로 유지한다.

import { newSectionId, type SourceSection } from "@/types/magazine-source";

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

// ── 구간 초안 생성 ───────────────────────────────────────────────────────────

/**
 * 나누는 기준. 어느 쪽도 "정답"이 아니므로 **어드민이 고르고 미리보기로 확인**한다.
 *  - marker: `p.12` 형태의 페이지 표기 줄 (본문에도 나올 수 있음 → 확인 필요)
 *  - number: 숫자만 있는 줄 (쪽번호만 적는 흔한 입력. 연도·수량과 헷갈릴 수 있음)
 *  - blank : 빈 줄 2개 이상 = 구간 경계 (페이지는 미지정 → 사람이 채움)
 *  - none  : 나누지 않고 통째로 한 구간
 */
export type SplitMode = "marker" | "number" | "blank" | "none";

/** 줄 전체가 숫자(장식문자 허용)면 그 숫자. `- 12 -`·`12.`도 인정. */
export function matchBareNumber(line: string): number | null {
  const m = line.match(/^[-–—=*#·・~_[\]<>(){}\s]*(\d{1,4})\s*\.?[-–—=*#·・~_[\]<>(){}\s]*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 원문 텍스트 → 구간 초안. 반환값은 **확정이 아니라 제안**이며, 어드민이 확인·수정한 뒤
 * 구조로 저장된다. maxPage를 주면 그보다 큰 페이지 번호는 마커로 보지 않는다
 * (40쪽짜리 매거진의 `p.300`은 본문일 가능성이 압도적).
 */
export function toDraftSections(
  raw: string,
  opts: { mode: SplitMode; maxPage?: number } = { mode: "marker" },
): SourceSection[] {
  const text = raw ?? "";
  if (!text.trim()) return [];

  const inRange = (n: number) => !opts.maxPage || n <= opts.maxPage;
  const detect = (line: string): number | null => {
    if (opts.mode === "marker") {
      const n = matchPageMarker(line);
      return n !== null && inRange(n) ? n : null;
    }
    if (opts.mode === "number") {
      const n = matchBareNumber(line);
      return n !== null && inRange(n) ? n : null;
    }
    return null;
  };

  if (opts.mode === "none") {
    return [
      { id: newSectionId(), pageFrom: null, pageTo: null, title: null, text: text.trim() },
    ];
  }

  if (opts.mode === "blank") {
    return text
      .split(/\n\s*\n\s*\n+/) // 빈 줄 2개 이상
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({
        id: newSectionId(),
        pageFrom: null,
        pageTo: null,
        title: null,
        text: t,
      }));
  }

  const sections: SourceSection[] = [];
  let pageFrom: number | null = null;
  let buf: string[] = [];
  const flush = () => {
    const t = buf.join("\n").trim();
    if (t)
      sections.push({ id: newSectionId(), pageFrom, pageTo: pageFrom, title: null, text: t });
    buf = [];
  };
  for (const line of text.split(/\r?\n/)) {
    const n = detect(line);
    if (n !== null) {
      flush();
      pageFrom = n;
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/** 목차(TocEntry)로 구간 골격 만들기 — 제목·페이지 범위가 이미 확정된 구조라 애매성이 없다. */
export function sectionsFromToc(
  toc: { title: string; pageNumber: number }[],
  pageCount: number,
): SourceSection[] {
  const sorted = [...toc].sort((a, b) => a.pageNumber - b.pageNumber);
  return sorted.map((entry, i) => {
    const next = sorted[i + 1];
    const end = next ? Math.max(entry.pageNumber, next.pageNumber - 1) : pageCount || entry.pageNumber;
    return {
      id: newSectionId(),
      pageFrom: entry.pageNumber,
      pageTo: end,
      title: entry.title,
      text: "",
    };
  });
}

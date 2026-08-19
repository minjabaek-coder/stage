// 매거진 원문 구간(Magazine.sourceSections, JSONB) 스펙.
//
// 이미지형 매거진은 지면이 비트맵이라 색인할 텍스트가 없다. 그 텍스트를 사람이 넣되,
// **페이지 귀속을 본문에서 파싱하지 않고 구조로 저장**한다.
//
// 왜 구조인가 — 본문 안에 `p.12` 같은 마커를 넣는 방식(in-band signaling)은
// "p. 45"(인용 출처)·"3쪽"(캡션)처럼 본문에 자연히 등장하는 줄과 구분이 원리적으로
// 불가능하고, 색인할 때마다 다시 파싱하므로 같은 텍스트가 나중에 다르게 해석될 수 있다.
// 신문·잡지 디지털화 표준(METS/ALTO)과 문서 RAG 파이프라인(Docling 등)이 모두
// 페이지 정보를 본문이 아닌 **구조/메타데이터**로 두는 이유가 이것이다.
// → 마커 파싱은 임포트 시 1회 초안 생성에만 쓰고(사람이 확인), 정본은 이 구조다.
// 상세 [docs/decisions/0007](../../docs/decisions/0007-source-sections.md).

export type SourceSection = {
  id: string;
  /** 이 구간이 실린 페이지 범위. null = 페이지 미지정(매거진 전체 소속). */
  pageFrom: number | null;
  pageTo: number | null;
  /** 구간 제목(목차 항목 등). 챗봇 출처칩에 쓰인다. */
  title: string | null;
  text: string;
  /**
   * AI 색인 대상 여부(기본 true). false면 저장은 하되 RAG에 넣지 않는다.
   *
   * 왜 관리자 판단인가: 표지·뒤표지처럼 짧고 일반적인 지면은 여러 질의에 걸려 출처칩을
   * 어지럽히고, 광고·안내면은 챗봇이 광고 문구로 답하게 만든다. 그렇다고 길이로 거르면
   * 안 된다 — 1호 실측에서 표지(61자)와 정상 콘텐츠인 오페라 산책(222자)이 같은 구간에
   * 있었다. 무엇이 '내용'인지는 지면을 본 사람만 안다.
   */
  indexable?: boolean;
};

/** 색인 대상인가(미지정이면 대상). */
export function isIndexable(s: Pick<SourceSection, "indexable">): boolean {
  return s.indexable !== false;
}

export function newSectionId(): string {
  return "s" + Math.random().toString(36).slice(2, 10);
}

function toPage(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** JSONB → SourceSection[]. 형식이 어긋나면 빈 배열(색인·편집 모두 안전한 기본값). */
export function parseSourceSections(json: unknown): SourceSection[] {
  if (!Array.isArray(json)) return [];
  const out: SourceSection[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.text !== "string") continue;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : newSectionId(),
      pageFrom: toPage(o.pageFrom),
      pageTo: toPage(o.pageTo),
      title:
        typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : null,
      text: o.text,
      // 미지정은 색인 대상(기존 데이터 호환) — false일 때만 제외한다.
      ...(o.indexable === false ? { indexable: false } : {}),
    });
  }
  return out;
}

/** 표시용 페이지 라벨: `12p` · `12–13p` · null(미지정). */
export function pageLabel(s: Pick<SourceSection, "pageFrom" | "pageTo">): string | null {
  if (s.pageFrom === null) return null;
  const to = s.pageTo ?? s.pageFrom;
  return to > s.pageFrom ? `${s.pageFrom}–${to}p` : `${s.pageFrom}p`;
}

/** 이 구간이 덮는 페이지 번호들(미지정이면 빈 배열). */
export function sectionPages(s: SourceSection): number[] {
  if (s.pageFrom === null) return [];
  const to = Math.max(s.pageFrom, s.pageTo ?? s.pageFrom);
  const pages: number[] = [];
  for (let p = s.pageFrom; p <= to; p++) pages.push(p);
  return pages;
}

// ── 검증 ─────────────────────────────────────────────────────────────────────
// 저장을 막는 error와, 저장은 되지만 알려줘야 하는 warn을 구분한다.
export type SectionIssue = {
  sectionId: string;
  level: "error" | "warn";
  message: string;
};

/** 청킹 최소 길이(chunker.ts MIN_CHUNK_LENGTH) — 이보다 짧으면 색인에서 통째로 빠진다. */
export const MIN_INDEXABLE_LENGTH = 20;

export function validateSections(
  sections: SourceSection[],
  pageCount: number,
): SectionIssue[] {
  const issues: SectionIssue[] = [];
  const seen = new Map<number, string>(); // 페이지 → 먼저 차지한 구간 id

  for (const s of sections) {
    const to = s.pageTo ?? s.pageFrom;
    if (s.pageFrom !== null && to !== null && to < s.pageFrom) {
      issues.push({
        sectionId: s.id,
        level: "error",
        message: "끝 페이지가 시작 페이지보다 앞섭니다",
      });
    }
    if (pageCount > 0) {
      for (const p of sectionPages(s)) {
        if (p > pageCount) {
          issues.push({
            sectionId: s.id,
            level: "error",
            message: `이 매거진은 ${pageCount}쪽까지입니다 (${p}쪽 지정됨)`,
          });
          break;
        }
      }
    }
    if (s.pageTo !== null && s.pageFrom === null) {
      issues.push({
        sectionId: s.id,
        level: "error",
        message: "끝 페이지만 있고 시작 페이지가 없습니다",
      });
    }
    // 색인 제외 구간에는 길이 경고를 띄우지 않는다(어차피 색인 대상이 아니라 잡음).
    if (isIndexable(s)) {
      if (!s.text.trim()) {
        issues.push({ sectionId: s.id, level: "warn", message: "내용이 비어 색인되지 않습니다" });
      } else if (s.text.trim().length < MIN_INDEXABLE_LENGTH) {
        issues.push({
          sectionId: s.id,
          level: "warn",
          message: `${MIN_INDEXABLE_LENGTH}자 미만이라 색인에서 제외됩니다`,
        });
      }
    }
    for (const p of sectionPages(s)) {
      const prev = seen.get(p);
      if (prev && prev !== s.id) {
        issues.push({
          sectionId: s.id,
          level: "warn",
          message: `${p}쪽이 다른 구간과 겹칩니다`,
        });
        break;
      }
      seen.set(p, s.id);
    }
  }
  return issues;
}

export function hasBlockingError(issues: SectionIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

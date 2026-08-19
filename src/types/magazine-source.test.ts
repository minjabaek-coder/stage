import { describe, it, expect } from "vitest";
import {
  parseSourceSections,
  validateSections,
  hasBlockingError,
  isIndexable,
  pageLabel,
  sectionPages,
  type SourceSection,
} from "./magazine-source";

// 매거진 원문 구간 = 이미지형 RAG 코퍼스의 정본 구조(decisions/0007).
// 여기서 가장 중요한 건 **본문에 페이지 표기가 있어도 귀속이 흔들리지 않는다**는 것이다.
// 예전 마커 방식은 색인할 때마다 본문을 재파싱해 같은 텍스트가 나중에 다르게 해석됐다.

const section = (o: Partial<SourceSection> = {}): SourceSection => ({
  id: "s1",
  pageFrom: 5,
  pageTo: 5,
  title: null,
  text: "충분히 긴 본문입니다. ".repeat(3),
  ...o,
});

describe("parseSourceSections — 페이지 귀속은 구조에서만 온다", () => {
  it("본문에 'p. 45'·'3쪽'·'12페이지'가 있어도 페이지 귀속이 바뀌지 않는다", () => {
    const trap = {
      id: "s1",
      pageFrom: 12,
      pageTo: 13,
      title: "OOO 인터뷰",
      text: "그는 이렇게 적었다.\np. 45\n인용은 여기서 끝난다.\n3쪽\n12페이지",
    };
    const [got] = parseSourceSections([trap]);
    expect(got.pageFrom).toBe(12);
    expect(got.pageTo).toBe(13);
    // 마커 줄을 삭제하지도 않는다 — 본문은 본문이다
    expect(got.text).toBe(trap.text);
  });

  it("배열이 아니거나 text가 없으면 버린다", () => {
    expect(parseSourceSections({ a: 1 })).toEqual([]);
    expect(parseSourceSections([{ id: "x", pageFrom: 1 }])).toEqual([]);
  });

  it("문자열 페이지 번호는 받아들이고, 0·음수는 미지정으로 본다", () => {
    expect(parseSourceSections([{ id: "x", pageFrom: "5", text: "본문" }])[0].pageFrom).toBe(5);
    expect(parseSourceSections([{ id: "x", pageFrom: 0, text: "본문" }])[0].pageFrom).toBeNull();
  });
});

describe("indexable — 관리자가 색인에서 뺀 구간", () => {
  it("플래그가 없으면 색인 대상이다(기존 데이터 호환)", () => {
    const [got] = parseSourceSections([{ id: "a", pageFrom: 5, text: "본문" }]);
    expect(isIndexable(got)).toBe(true);
    // 기본값이면 키를 만들지 않는다(불필요한 저장 방지)
    expect("indexable" in got).toBe(false);
  });

  it("false만 보존된다 — true는 기본값이라 저장하지 않는다", () => {
    const [off] = parseSourceSections([{ id: "b", pageFrom: 1, text: "표지", indexable: false }]);
    expect(off.indexable).toBe(false);
    const [on] = parseSourceSections([{ id: "c", pageFrom: 2, text: "본문", indexable: true }]);
    expect("indexable" in on).toBe(false);
  });

  it("불린이 아닌 값은 기본값(색인 대상)으로 떨어진다", () => {
    const [got] = parseSourceSections([{ id: "d", pageFrom: 3, text: "본문", indexable: "no" }]);
    expect(isIndexable(got)).toBe(true);
  });
});

describe("validateSections — 저장을 막을 것과 알려만 줄 것", () => {
  const PAGES = 40;

  it("끝<시작 / 페이지 수 초과 / 시작 없이 끝만 → 저장 차단", () => {
    for (const bad of [
      section({ id: "a", pageFrom: 10, pageTo: 5 }),
      section({ id: "b", pageFrom: 300, pageTo: 300 }),
      section({ id: "c", pageFrom: null, pageTo: 7 }),
    ]) {
      expect(hasBlockingError(validateSections([bad], PAGES))).toBe(true);
    }
  });

  it("20자 미만은 경고만 — 조용히 색인에서 빠지는 걸 알려주기 위함", () => {
    const issues = validateSections([section({ text: "짧음" })], PAGES);
    expect(issues.some((i) => i.level === "warn" && i.message.includes("20자 미만"))).toBe(true);
    expect(hasBlockingError(issues)).toBe(false);
  });

  it("색인 제외 구간에는 길이 경고를 띄우지 않는다(잡음)", () => {
    const issues = validateSections(
      [section({ text: "짧음", indexable: false })],
      PAGES,
    );
    expect(issues.some((i) => i.message.includes("20자 미만"))).toBe(false);
  });

  it("색인 제외라도 페이지 범위 오류는 그대로 막는다", () => {
    const issues = validateSections(
      [section({ pageFrom: 300, pageTo: 300, indexable: false })],
      PAGES,
    );
    expect(hasBlockingError(issues)).toBe(true);
  });

  it("페이지가 겹치면 경고한다", () => {
    const issues = validateSections(
      [section({ id: "a", pageFrom: 12, pageTo: 12 }), section({ id: "b", pageFrom: 12, pageTo: 12 })],
      PAGES,
    );
    expect(issues.some((i) => i.message.includes("겹칩니다"))).toBe(true);
  });
});

describe("표시 보조", () => {
  it("pageLabel", () => {
    expect(pageLabel({ pageFrom: 12, pageTo: 13 })).toBe("12–13p");
    expect(pageLabel({ pageFrom: 12, pageTo: 12 })).toBe("12p");
    expect(pageLabel({ pageFrom: null, pageTo: null })).toBeNull();
  });

  it("sectionPages는 범위를 펼친다(중복 방지 판정에 쓰인다)", () => {
    expect(sectionPages(section({ pageFrom: 12, pageTo: 14 }))).toEqual([12, 13, 14]);
    expect(sectionPages(section({ pageFrom: null, pageTo: null }))).toEqual([]);
  });
});

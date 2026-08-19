import { describe, it, expect } from "vitest";
import {
  matchPageMarker,
  matchBareNumber,
  toDraftSections,
  sectionsFromToc,
} from "./magazine-source-text";

// 이 모듈은 **임포트 시 1회 초안 생성**에만 쓰인다(정본은 구조 — decisions/0007).
// 그래서 여기 테스트의 목적은 "완벽한 인식"이 아니라 **본문을 마커로 오인하지 않는 것**과
// 사람이 확인할 초안이 그럴듯하게 나오는 것이다.

describe("matchPageMarker — 줄 전체가 페이지 표기일 때만", () => {
  it.each([
    ["p.12", 12],
    ["P 12", 12],
    ["page 12", 12],
    ["pp.7", 7],
    ["12p", 12],
    ["12페이지", 12],
    ["3쪽", 3],
    ["페이지 40", 40],
    ["--- p.12 ---", 12],
    ["## p.12", 12],
    ["[p.5]", 5],
    ["p.12-13", 12], // 범위는 시작 쪽에 귀속
    ["  p.12  ", 12],
  ])("마커로 인식: %s", (line, expected) => {
    expect(matchPageMarker(line)).toBe(expected);
  });

  it.each([
    ["12페이지에서 보듯 그의 연주는"], // 본문 한가운데
    ["약 3쪽 분량의 인터뷰"],
    ["12"], // 숫자만 — marker 모드에서는 본문
    ["---"],
    [""],
    ["표지 — 2026 봄호"],
    ["p.s. 편집자 주"],
  ])("본문으로 남김: %s", (line) => {
    expect(matchPageMarker(line)).toBeNull();
  });
});

describe("matchBareNumber — 숫자만 있는 줄", () => {
  it.each([
    ["12", 12],
    ["- 12 -", 12],
    ["12.", 12],
    ["  7  ", 7],
  ])("인식: %s", (line, expected) => {
    expect(matchBareNumber(line)).toBe(expected);
  });

  it("숫자가 아니면 null", () => {
    expect(matchBareNumber("12페이지")).toBeNull();
    expect(matchBareNumber("본문입니다")).toBeNull();
  });
});

describe("toDraftSections — 초안일 뿐 확정이 아니다", () => {
  const raw = ["머리말입니다.", "p.4", "편집장의 글.", "p.300", "본문처럼 보이는 줄."].join("\n");

  it("marker 모드: maxPage를 넘는 번호는 마커로 보지 않는다", () => {
    // 40쪽짜리 매거진의 'p.300'은 본문일 가능성이 압도적
    const d = toDraftSections(raw, { mode: "marker", maxPage: 40 });
    expect(d).toHaveLength(2);
    expect(d[0].pageFrom).toBeNull(); // 머리말
    expect(d[1].pageFrom).toBe(4);
    expect(d[1].text).toContain("p.300"); // 본문으로 흡수됨
  });

  it("number 모드: 숫자만 있는 줄로 나눈다", () => {
    const d = toDraftSections("앞글\n12\n뒷글입니다", { mode: "number", maxPage: 40 });
    expect(d.map((x) => x.pageFrom)).toEqual([null, 12]);
  });

  it("blank 모드: 빈 줄 2개 이상, 페이지는 미지정", () => {
    const d = toDraftSections("가\n\n\n나\n\n\n다", { mode: "blank" });
    expect(d).toHaveLength(3);
    expect(d.every((x) => x.pageFrom === null)).toBe(true);
  });

  it("none 모드: 통째로 한 구간", () => {
    const d = toDraftSections(raw, { mode: "none" });
    expect(d).toHaveLength(1);
    expect(d[0].pageFrom).toBeNull();
  });

  it("빈 입력은 빈 배열", () => {
    expect(toDraftSections("", { mode: "marker" })).toEqual([]);
    expect(toDraftSections("   \n  ", { mode: "marker" })).toEqual([]);
  });
});

describe("sectionsFromToc — 목차로 만드는 골격(애매성 없는 경로)", () => {
  const toc = [
    { title: "편집장의 글", pageNumber: 4 },
    { title: "특집", pageNumber: 12 },
    { title: "리뷰", pageNumber: 20 },
  ];

  it("다음 항목 페이지-1까지를 한 구간으로, 마지막은 총 페이지까지", () => {
    const s = sectionsFromToc(toc, 30);
    expect(s.map((x) => [x.pageFrom, x.pageTo, x.title])).toEqual([
      [4, 11, "편집장의 글"],
      [12, 19, "특집"],
      [20, 30, "리뷰"],
    ]);
  });

  it("본문은 비워 사람이 채우게 한다", () => {
    expect(sectionsFromToc(toc, 30).every((x) => x.text === "")).toBe(true);
  });

  it("정렬되지 않은 목차도 페이지순으로 정리한다", () => {
    const s = sectionsFromToc([toc[2], toc[0], toc[1]], 30);
    expect(s.map((x) => x.pageFrom)).toEqual([4, 12, 20]);
  });
});

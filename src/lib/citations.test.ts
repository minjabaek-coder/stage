import { describe, it, expect } from "vitest";
import { extractCitations } from "./citations";

// 출처칩을 '모델이 실제로 인용한 자료'로 좁히는 파서(decisions 없음 — design/ai-maestro B.0.2).
// 가장 중요한 성질 두 가지:
//  ① 인용 줄이 사용자에게 새어 나가면 안 된다
//  ② 형식을 안 지켰으면 **필터하지 않는다**(출처 0개가 되는 편이 더 나쁘다)

describe("extractCitations", () => {
  it("인용 줄을 답변에서 떼어내고 번호를 돌려준다", () => {
    const { text, refs } = extractCitations("바르톨로 역을 맡았습니다.\n[출처: 3]");
    expect(text).toBe("바르톨로 역을 맡았습니다.");
    expect(refs).toEqual([3]);
  });

  it("여러 번호·공백·전각 콜론을 받아들인다", () => {
    expect(extractCitations("답변\n[출처: 1, 3, 5]").refs).toEqual([1, 3, 5]);
    expect(extractCitations("답변\n[ 출처 ： 2 , 4 ]").refs).toEqual([2, 4]);
  });

  it("인용 줄이 없으면 원문 그대로, refs는 null(=필터하지 않음)", () => {
    const { text, refs } = extractCitations("근거 없이 답한 경우");
    expect(text).toBe("근거 없이 답한 경우");
    expect(refs).toBeNull();
  });

  it("번호가 하나도 유효하지 않으면 필터하지 않는다", () => {
    // 줄은 떼어내되 refs는 null → 출처를 전부 보여준다
    expect(extractCitations("답변\n[출처: 0]").refs).toBeNull();
  });

  it("본문 중간의 대괄호는 건드리지 않는다", () => {
    const t = "리뷰[1]에 따르면 그렇습니다.";
    const { text, refs } = extractCitations(t);
    expect(text).toBe(t);
    expect(refs).toBeNull();
  });

  it("답변 끝 공백·줄바꿈이 있어도 인식한다", () => {
    expect(extractCitations("답변\n[출처: 7]\n\n  ").refs).toEqual([7]);
  });

  it("인용 줄만 있으면 본문은 빈 문자열이 된다(호출 측에서 원문 폴백)", () => {
    expect(extractCitations("[출처: 1]").text).toBe("");
  });

  // 코퍼스 밖 질문을 허용한 뒤(decisions/0010) 생긴 구분.
  // "줄이 없음"(=실수, 전부 노출)과 "근거가 없음"(=의도, 칩 0개)은 다르다.
  describe("[출처: 없음] — 매거진 근거 없이 답했다는 명시적 신고", () => {
    it("refs를 빈 배열로 돌려준다(null이 아니다)", () => {
      const { text, refs } = extractCitations(
        "매거진에 실린 내용은 아니지만, 베르디는 1813년생입니다.\n[출처: 없음]",
      );
      expect(text).toBe("매거진에 실린 내용은 아니지만, 베르디는 1813년생입니다.");
      expect(refs).toEqual([]);
    });

    it("빈 배열과 null은 구분된다 — 호출 측 분기의 근거", () => {
      expect(extractCitations("답변\n[출처: 없음]").refs).toEqual([]);
      expect(extractCitations("답변").refs).toBeNull();
    });

    it("공백·전각 콜론이 섞여도 인식한다", () => {
      expect(extractCitations("답변\n[ 출처 ： 없음 ]").refs).toEqual([]);
    });
  });

  // 운영 실측: 모델이 `[출처: 38호 목차]`처럼 자유 문구를 쓰면 종전 정규식(숫자만)에
  // 걸리지 않아 그 줄이 사용자 화면에 그대로 노출됐다.
  describe("형식을 벗어난 인용 줄", () => {
    it("자유 문구여도 줄은 반드시 걷어낸다", () => {
      const { text, refs } = extractCitations(
        "태승진 대표는 부천아트센터 초대 대표입니다.\n[출처: 38호 목차]",
      );
      expect(text).toBe("태승진 대표는 부천아트센터 초대 대표입니다.");
      // 번호를 못 읽었으니 필터하지 않는다(출처 0개가 더 나쁘다).
      expect(refs).toBeNull();
    });

    it("호수를 자료 번호로 오인하지 않는다", () => {
      // "38호"를 parseInt로 읽으면 38이 되어 엉뚱한 칩을 고른다 → 순수 숫자만 인정.
      expect(extractCitations("답변\n[출처: 38호 목차 3]").refs).toBeNull();
      expect(extractCitations("답변\n[출처: 38호]").refs).toBeNull();
    });

    it("순수 숫자 목록은 그대로 인정한다", () => {
      expect(extractCitations("답변\n[출처: 1, 3]").refs).toEqual([1, 3]);
    });

    it("본문 중간의 대괄호는 여전히 건드리지 않는다", () => {
      const t = "리뷰[1]에 따르면 그렇습니다.";
      expect(extractCitations(t).text).toBe(t);
    });

    it("줄바꿈이 들어간 대괄호는 인용 줄로 보지 않는다", () => {
      const t = "답변\n[출처:\n여러 줄]";
      expect(extractCitations(t).text).toBe(t);
    });
  });
});

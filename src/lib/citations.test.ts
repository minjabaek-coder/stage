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
});

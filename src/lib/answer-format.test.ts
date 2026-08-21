import { describe, it, expect } from "vitest";
import {
  formatAnswerText,
  formatAnswerFragment,
  dropEmptySourcePromise,
  splitEmittable,
} from "./answer-format";

// 채팅 말풍선은 마크다운을 렌더하지 않는다 → 기호가 그대로 보인다.
// 가장 중요한 성질: ①기호는 지우되 ②내용과 줄 구조는 보존한다.

describe("formatAnswerText", () => {
  it("굵게 표시를 벗겨내고 내용은 남긴다", () => {
    expect(formatAnswerText("가장 최신호인 **39호**에서 확인하세요.")).toBe(
      "가장 최신호인 39호에서 확인하세요.",
    );
    expect(formatAnswerText("__강조__된 말")).toBe("강조된 말");
  });

  it("여러 개가 섞여도 모두 처리한다", () => {
    expect(formatAnswerText("**쿠사다시**와 **산토리니**")).toBe("쿠사다시와 산토리니");
  });

  it("불릿을 가운뎃점으로 바꾸고 줄 구조는 지킨다", () => {
    // 목차 답변이 실제로 이 형태로 온다(S1-1)
    const out = formatAnswerText("1호 목차입니다.\n* 1쪽: 표지\n* 5쪽: 커버스토리");
    expect(out).toBe("1호 목차입니다.\n· 1쪽: 표지\n· 5쪽: 커버스토리");
  });

  it("하이픈·플러스 불릿과 들여쓰기도 처리한다", () => {
    expect(formatAnswerText("- 가\n  + 나")).toBe("· 가\n· 나");
  });

  // 도구 결과에 URL이 없으므로 모델이 쓴 주소는 전부 지어낸 것이다(실측: stage-mag.kr).
  it("마크다운 링크는 표시글만 남기고 주소를 버린다", () => {
    expect(
      formatAnswerText("[STAGE 1호 커버스토리](https://stage-mag.kr/magazines/1/contents/6)에 있습니다."),
    ).toBe("STAGE 1호 커버스토리에 있습니다.");
  });

  it("상대경로 링크도 처리한다", () => {
    expect(formatAnswerText("[38호](/magazines/abc123)를 보세요")).toBe("38호를 보세요");
  });

  it("링크가 아닌 대괄호는 건드리지 않는다", () => {
    expect(formatAnswerText("리뷰[1]에 따르면")).toBe("리뷰[1]에 따르면");
    expect(formatAnswerText("[참고] 다음 내용")).toBe("[참고] 다음 내용");
  });

  it("제목 표시(#)를 제거한다", () => {
    expect(formatAnswerText("## 39호 소개\n내용")).toBe("39호 소개\n내용");
  });

  it("과한 빈 줄을 줄인다", () => {
    expect(formatAnswerText("가\n\n\n\n나")).toBe("가\n\n나");
  });

  // 지우면 안 되는 것들 — 과잉 처리 방지
  it("본문 중간의 별표·하이픈은 건드리지 않는다", () => {
    expect(formatAnswerText("5*3은 15입니다")).toBe("5*3은 15입니다");
    expect(formatAnswerText("2025-2026 시즌")).toBe("2025-2026 시즌");
  });

  it("짝이 맞지 않는 별표는 그대로 둔다", () => {
    expect(formatAnswerText("**닫히지 않은 강조")).toBe("**닫히지 않은 강조");
  });

  it("빈 문자열·평범한 문장은 그대로", () => {
    expect(formatAnswerText("")).toBe("");
    expect(formatAnswerText("평범한 답변입니다.")).toBe("평범한 답변입니다.");
  });
});

// 출처칩이 없는데 "아래 출처 링크에서 보세요"라고 하면 빈 약속이 된다.
describe("dropEmptySourcePromise", () => {
  it("출처가 없으면 출처를 약속한 문장만 지운다", () => {
    expect(
      dropEmptySourcePromise("38호는 발행된 호입니다. 아래 출처 링크에서 바로 보실 수 있어요.", false),
    ).toBe("38호는 발행된 호입니다.");
  });

  it("출처가 있으면 그대로 둔다", () => {
    const t = "38호는 발행된 호입니다. 아래 출처 링크에서 바로 보실 수 있어요.";
    expect(dropEmptySourcePromise(t, true)).toBe(t);
  });

  it("별도 줄에 있는 안내도 지우고 빈 줄을 남기지 않는다", () => {
    expect(dropEmptySourcePromise("본문입니다.\n\n아래 출처 링크에서 보실 수 있어요.", false)).toBe(
      "본문입니다.",
    );
  });

  it("출처와 무관한 문장은 건드리지 않는다", () => {
    const t = "1호에 실려 있습니다.\n· 5쪽: 커버스토리";
    expect(dropEmptySourcePromise(t, false)).toBe(t);
  });

  it("모든 문장이 지워지면 빈 문자열(호출 측에서 폴백)", () => {
    expect(dropEmptySourcePromise("아래 출처 링크를 확인하세요.", false)).toBe("");
  });
});

describe("formatAnswerFragment", () => {
  it("조각의 앞뒤 공백을 지우지 않는다(단어가 붙는 것을 막는다)", () => {
    expect(formatAnswerFragment("베르디는 ")).toBe("베르디는 ");
    expect(formatAnswerFragment(" 작곡가입니다.")).toBe(" 작곡가입니다.");
  });

  it("마크다운 정리는 동일하게 한다", () => {
    expect(formatAnswerFragment("**39호**입니다. ")).toBe("39호입니다. ");
  });
});

// 스트리밍 중에는 '완성돼야 알 수 있는 것'을 내보내면 안 된다.
describe("splitEmittable", () => {
  it("완결된 문장까지만 내보내고 미완성 문장은 보류한다", () => {
    const { emit, hold } = splitEmittable("첫 문장입니다. 두 번째는 아직");
    // 경계는 구두점까지 — 뒤따르는 공백은 다음 조각과 함께 나간다.
    expect(emit).toBe("첫 문장입니다.");
    expect(hold).toBe(" 두 번째는 아직");
  });

  it("완결 문장이 하나도 없으면 전부 보류", () => {
    expect(splitEmittable("아직 문장이 안 끝났")).toEqual({
      emit: "",
      hold: "아직 문장이 안 끝났",
    });
  });

  it("줄바꿈도 경계로 인정한다(목차형 답변)", () => {
    const { emit, hold } = splitEmittable("1호 목차입니다\n· 5쪽: 커버");
    expect(emit).toBe("1호 목차입니다\n");
    expect(hold).toBe("· 5쪽: 커버");
  });

  it("대괄호가 나오면 그 뒤는 보류한다 — 인용 줄이 샐 수 있다", () => {
    const { emit, hold } = splitEmittable("답변입니다. [출처: 1]");
    expect(emit).toBe("답변입니다.");
    expect(hold).toBe(" [출처: 1]");
  });

  it("인용 줄이 문장 경계 없이 이어져도 새지 않는다", () => {
    expect(splitEmittable("답변입니다.\n[출처: 1, 3]").emit).toBe("답변입니다.\n");
  });

  it("출처를 약속하는 문장부터 보류한다 — 출처 수는 끝나야 안다", () => {
    const { emit, hold } = splitEmittable(
      "1호 커버스토리입니다. 아래 출처 링크에서 보실 수 있어요. ",
    );
    // 이 경계는 문장 분리(뒤 공백 포함)로 잡히므로 emit이 공백까지 가져간다.
    expect(emit).toBe("1호 커버스토리입니다. ");
    expect(hold).toBe("아래 출처 링크에서 보실 수 있어요. ");
  });

  it("빈 버퍼는 그대로", () => {
    expect(splitEmittable("")).toEqual({ emit: "", hold: "" });
  });

  it("이어붙이면 항상 원본과 같다(글자 유실 없음)", () => {
    for (const s of [
      "가나다. 라마바",
      "한 줄\n두 줄\n세 번째는 미완",
      "본문. 아래 출처 링크 안내.",
      "[출처: 2]",
      "끝맺음 없는 문장",
    ]) {
      const { emit, hold } = splitEmittable(s);
      expect(emit + hold).toBe(s);
    }
  });
});

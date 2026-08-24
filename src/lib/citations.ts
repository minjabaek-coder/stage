// 답변 끝의 `[출처: 1, 3]` 줄을 떼어내고 인용된 자료 번호를 돌려준다.
//
// 검색 순위와 '실제로 근거가 된 자료'는 다르다 — 실측에서 정답 청크가 3위였고 1·2위는
// 답변에 쓰이지도 않은 무관한 지면이었다. 모델이 이미 옳게 골랐으므로 그 판단을 출처칩에
// 반영한다(docs/design/ai-maestro.md B.0.2).
//
// route.ts에서 분리한 이유는 **테스트 가능하게** 하기 위함이다. 라우트 핸들러 안에 있으면
// 단위 테스트에서 부를 수 없다.
// `없음`은 "매거진 근거 없이 일반 지식으로 답했다"는 **명시적 신고**다(refs=[]).
// 줄 자체가 없는 것(refs=null, 형식 미준수)과 구분해야 한다 — 코퍼스 밖 질문을 허용한 뒤로
// 인용 줄 생략이 '실수'가 아니라 '정상'인 경우가 생겼기 때문이다(decisions/0010).
// 안쪽 내용은 **무엇이든** 받는다. 숫자만 받게 해두었더니 모델이
// `[출처: 38호 목차]`처럼 자유 문구를 쓸 때 정규식에 걸리지 않아 그 줄이
// **사용자 화면에 그대로 노출**됐다(운영 실측).
//
// 걷어내기(줄 제거)와 고르기(어떤 칩을 남길지)는 별개다:
//  · 줄은 형식과 무관하게 항상 뗀다 — 내부용 표시가 새면 안 된다.
//  · 번호를 못 읽으면 refs=null로 두어 **필터하지 않는다**(출처 0개가 더 나쁘다).
const CITATION_RE = /\[\s*출처\s*[:：][^\]\n]*\]\s*$/;
const NONE_RE = /^\s*없음\s*$/;

export function extractCitations(text: string): {
  text: string;
  refs: number[] | null;
} {
  const trimmed = text.trimEnd();
  const m = trimmed.match(CITATION_RE);
  // 줄 자체가 없으면 필터하지 않는다(refs=null).
  if (!m) return { text, refs: null };

  const stripped = trimmed.slice(0, m.index).trimEnd();
  const inner = m[0].replace(/^\[\s*출처\s*[:：]/, "").replace(/\]$/, "");
  if (NONE_RE.test(inner)) return { text: stripped, refs: [] };

  // **순수 숫자만** 자료 번호로 인정한다. parseInt를 쓰면 "38호"가 38로 읽혀
  // 호수를 자료 번호로 오인하고, 엉뚱한 칩을 고르거나 필터를 헛돌게 만든다.
  const refs = inner
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map(Number)
    .filter((n) => n > 0);
  return {
    text: stripped,
    refs: refs.length > 0 ? refs : null,
  };
}

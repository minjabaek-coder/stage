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
const CITATION_RE = /\[\s*출처\s*[:：]\s*(없음|[\d\s,]+)\s*\]\s*$/;

export function extractCitations(text: string): {
  text: string;
  refs: number[] | null;
} {
  const m = text.trimEnd().match(CITATION_RE);
  // 형식을 안 지켰으면 필터하지 않는다(refs=null) — 출처가 0개가 되는 편이 더 나쁘다.
  if (!m) return { text, refs: null };
  const stripped = text.trimEnd().slice(0, m.index).trimEnd();
  if (m[1] === "없음") return { text: stripped, refs: [] };
  const refs = m[1]
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  return {
    text: stripped,
    refs: refs.length > 0 ? refs : null,
  };
}

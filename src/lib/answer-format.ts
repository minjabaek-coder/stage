// 도슨트 답변을 **평문 말풍선**에 맞게 다듬는다.
//
// 채팅 말풍선은 마크다운 파서 없이 문자열을 그대로 렌더한다(docent-chat.tsx).
// 그래서 모델이 `**39호**`라고 쓰면 사용자에게 별표가 그대로 보인다 —
// 실사용 98건 중 8건(8%)에서 실제로 발생했다.
//
// 프롬프트로 "마크다운을 쓰지 마세요"라고 지시하지만 준수는 확률적이다.
// 서버에서 한 번 더 **결정적으로** 정리해 화면을 보장한다.
//
// 마크다운을 렌더링하지 않고 제거하는 쪽을 택한 이유:
// 답변이 짧고(기본 2-3문장) 목차 정도가 유일한 나열이라, 파서 의존성과
// 그에 따르는 XSS 표면을 늘릴 만한 이득이 없다(decisions/0011).

/**
 * `[표시글](주소)` → 표시글.
 *
 * 도구 결과에는 URL이 들어 있지 않다(href는 출처칩용으로 서버만 쓴다). 따라서 모델이
 * 써내는 주소는 **전부 지어낸 것**이다 — 실측에서 우리 도메인도 아닌
 * `https://stage-mag.kr/...`를 만들어냈다. 렌더도 안 되고 사실도 아니므로 주소는 버리고
 * 표시글만 남긴다. 진짜 링크는 답변 아래 출처칩이 담당한다.
 */
const MD_LINK = /\[([^\]\n]+)\]\((?:https?:\/\/|\/)[^)\s]*\)/g;
/** `**굵게**` / `__굵게__` → 굵게 */
const BOLD = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;
/** 줄 첫머리의 `* ` `- ` `+ ` 불릿 → `· ` */
const BULLET = /^[ \t]*[*\-+][ \t]+/gm;
/** 줄 첫머리의 `#` 제목 표시 제거 */
const HEADING = /^[ \t]*#{1,6}[ \t]+/gm;
/** 3줄 이상 연속 개행 → 2줄 */
const EXTRA_BLANK = /\n{3,}/g;

export function formatAnswerText(text: string): string {
  if (!text) return text;
  return text
    .replace(MD_LINK, "$1")
    .replace(BOLD, "$2")
    .replace(HEADING, "")
    .replace(BULLET, "· ")
    .replace(EXTRA_BLANK, "\n\n")
    .trim();
}

/** "아래 출처 링크에서 보실 수 있어요" 류의 안내 문장 */
const SOURCE_PROMISE = /(아래|하단)[^.!?\n]*출처|출처 링크/;

/**
 * 출처칩이 하나도 없는데 "아래 출처 링크에서 보세요"라고 안내하면 **빈 약속**이 된다.
 * 링크는 출처를 만드는 도구(`get_magazine_contents` 등)를 호출해야만 생기는데,
 * 모델이 `get_magazine_facts`만 부르고 안내 문구를 붙이는 경우를 실측했다.
 *
 * 프롬프트로도 지시하지만 준수는 확률적이라, 해당 문장만 결정적으로 걷어낸다.
 * 문장 단위로 지우므로 나머지 답변 내용은 그대로 남는다.
 */
export function dropEmptySourcePromise(text: string, hasSources: boolean): string {
  if (!text || hasSources) return text;
  const kept = text
    .split(/\n+/)
    .map((line) =>
      line
        // 문장 부호를 유지한 채 분리한 뒤, 출처를 약속하는 문장만 버린다.
        .split(/(?<=[.!?])\s+/)
        .filter((s) => !SOURCE_PROMISE.test(s))
        .join(" ")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join("\n");
  return kept.trim();
}

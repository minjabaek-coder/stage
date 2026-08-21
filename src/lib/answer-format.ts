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

function stripMarkup(text: string): string {
  return text
    .replace(MD_LINK, "$1")
    .replace(BOLD, "$2")
    .replace(HEADING, "")
    .replace(BULLET, "· ")
    .replace(EXTRA_BLANK, "\n\n");
}

export function formatAnswerText(text: string): string {
  if (!text) return text;
  return stripMarkup(text).trim();
}

/**
 * 스트리밍 중 **조각**에 쓰는 판 — trim을 하지 않는다.
 * 조각마다 trim하면 조각 경계의 공백이 사라져 단어가 서로 붙는다.
 */
export function formatAnswerFragment(text: string): string {
  return text ? stripMarkup(text) : text;
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

/** 문장 끝(마침표류) 또는 줄바꿈 = 내보내도 되는 경계 */
const BOUNDARY = /\n|[.!?…]["')\]]*(?=\s|$)/g;

/** `text` 안에서 출처를 약속하는 문장이 시작되는 위치(없으면 -1) */
function sourcePromiseStart(text: string): number {
  let at = 0;
  for (const piece of text.split(/(?<=[.!?…]\s)|(?<=\n)/)) {
    if (SOURCE_PROMISE.test(piece)) return at;
    at += piece.length;
  }
  return -1;
}

/**
 * 스트리밍 버퍼를 **지금 내보내도 되는 부분**과 **끝까지 봐야 아는 부분**으로 나눈다.
 *
 * 답변을 받는 즉시 흘려보내고 싶지만, 후처리 세 가지가 완성된 텍스트를 요구한다:
 * ①`[출처: …]` 인용 줄 제거 ②마크다운 정리 ③출처 0개일 때 "아래 출처 링크" 문장 제거.
 * 그래서 다음 세 가지를 보류한다.
 *
 * - **`[` 이후 전부** — 인용 줄의 시작일 수 있다. 인용 줄이 사용자에게 새면 안 된다.
 * - **출처를 약속하는 문장부터** — 출처 수는 인용 줄을 봐야 알 수 있다.
 * - **마지막 미완성 문장** — `**굵게**`가 문장 중간에서 잘리면 기호가 새어 나간다.
 */
export function splitEmittable(buffer: string): { emit: string; hold: string } {
  if (!buffer) return { emit: "", hold: "" };

  const bracket = buffer.indexOf("[");
  const head = bracket === -1 ? buffer : buffer.slice(0, bracket);

  let cut = 0;
  BOUNDARY.lastIndex = 0;
  for (let m = BOUNDARY.exec(head); m; m = BOUNDARY.exec(head)) {
    cut = m.index + m[0].length;
  }
  if (cut <= 0) return { emit: "", hold: buffer };

  let emit = buffer.slice(0, cut);
  const promise = sourcePromiseStart(emit);
  if (promise !== -1) emit = emit.slice(0, promise);
  if (!emit) return { emit: "", hold: buffer };

  return { emit, hold: buffer.slice(emit.length) };
}

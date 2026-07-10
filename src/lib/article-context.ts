// 현재 열람 중인 기사 제목(클라이언트 전역). 도슨트 챗이 "이 기사"·"해당 기사"를
// 현재 보고 있는 기사로 이해하도록, 기사 페이지가 설정하고 ChatBody가 읽는다.
let currentArticleTitle: string | null = null;

export function setCurrentArticleTitle(title: string | null): void {
  currentArticleTitle = title;
}

export function getCurrentArticleTitle(): string | null {
  return currentArticleTitle;
}

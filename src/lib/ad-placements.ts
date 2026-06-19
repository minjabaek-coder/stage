// 광고 노출 위치 화이트리스트 (공개 슬롯). 서버액션·클라이언트 폼·AdSlot 공용.
export const AD_PLACEMENTS = [
  { value: "home", label: "홈" },
  { value: "magazines", label: "매거진 목록" },
  { value: "articles", label: "기사" },
  { value: "sidebar", label: "사이드바" },
] as const;

export const AD_PLACEMENT_VALUES: string[] = AD_PLACEMENTS.map((p) => p.value);

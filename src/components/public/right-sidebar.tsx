// 우측 상시 사이드바. B1에서는 셸(슬롯)만 — 위젯(광고·티켓·StageOS·최근 기사·
// 뉴스레터)은 B2에서 채운다. 데스크탑(lg+)에서만 노출.
export function RightSidebar() {
  return (
    <aside className="hidden w-[280px] flex-shrink-0 lg:block">
      <div className="sticky top-[calc(3.5rem+3rem)] space-y-4">
        <div className="rounded-lg border border-dashed border-gray-200 p-5 text-center text-xs leading-relaxed text-gray-400">
          사이드바 위젯 영역
          <br />
          광고 · 티켓 · StageOS · 최근 기사 · 뉴스레터
          <br />
          <span className="text-gray-300">(B2에서 추가됩니다)</span>
        </div>
      </div>
    </aside>
  );
}

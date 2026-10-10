// DB를 읽지 못해 콘텐츠가 비어 있을 때의 안내. "아직 발행된 게 없음"과 반드시
// 구분해서 보여준다 — 장애를 '빈 아카이브'로 보여주면 사용자는 콘텐츠가 사라진
// 줄 알고, 우리는 장애를 모르고 지나간다.
//
// 페이지를 500으로 떨구지 않는 것이 목적이므로 이 컴포넌트 자체는 DB를 읽지 않는다.
// 받침 유무로 목적격 조사를 고른다 — "콘텐츠를" / "매거진을".
function objectParticle(word: string): "을" | "를" {
  const last = word.trim().slice(-1).charCodeAt(0);
  const isHangulSyllable = last >= 0xac00 && last <= 0xd7a3;
  if (!isHangulSyllable) return "을"; // 영문·숫자로 끝나면 보수적으로
  return (last - 0xac00) % 28 === 0 ? "를" : "을";
}

export function DbUnavailableNotice({
  what = "콘텐츠",
  className,
}: {
  what?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`border border-terra/25 bg-terra/5 px-5 py-6 ${className ?? ""}`}
    >
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-terra">
        Temporarily Unavailable
      </p>
      <p className="font-headline mt-2 text-lg font-bold tracking-tight text-ink">
        {what}
        {objectParticle(what)} 지금 불러올 수 없습니다
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
        일시적인 문제로 데이터를 읽지 못했습니다. 콘텐츠가 사라진 것은 아니며, 잠시 후
        새로고침하면 다시 보입니다.
      </p>
    </div>
  );
}

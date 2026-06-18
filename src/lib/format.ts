// 서버(Node ICU)와 클라이언트(브라우저)의 toLocaleString 결과가 달라(예: "PM" vs "오후",
// 런타임 타임존 차이) 클라이언트 컴포넌트에서 하이드레이션 불일치가 난다.
// → locale·런타임 비의존의 결정적 KST(UTC+9) 포맷터로 대체한다.

const pad = (n: number) => String(n).padStart(2, "0");

function toKST(input: Date | string): Date {
  const d = new Date(input);
  // UTC 타임스탬프를 +9h 시프트한 뒤 getUTC*로 읽으면 런타임 TZ와 무관하게 KST가 된다.
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}

/** "2026.06.18 22:58:56" (KST, 24시간) */
export function formatKST(input: Date | string): string {
  const k = toKST(input);
  return (
    `${k.getUTCFullYear()}.${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())} ` +
    `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}:${pad(k.getUTCSeconds())}`
  );
}

/** "2026.06.18" (KST) */
export function formatKSTDate(input: Date | string): string {
  const k = toKST(input);
  return `${k.getUTCFullYear()}.${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())}`;
}

import Link from "next/link";
import type { CultureEvent } from "@/types/culture-event";

type CardData = Pick<
  CultureEvent,
  | "slug"
  | "type"
  | "genre"
  | "title"
  | "venue"
  | "startDate"
  | "endDate"
  | "thumbnailUrl"
  | "memberDiscount"
>;

function dateRange(start: Date, end: Date | null): string {
  const f = (d: Date) =>
    new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return end ? `${f(start)} – ${f(end)}` : f(start);
}

/**
 * `ended` — 이미 끝난 공연임을 카드에서 분명히 한다.
 * 날짜만 적어두면 방문자가 지난 공연인지 알아채기 어렵고, 할인 배지가 함께 있으면
 * 지금 받을 수 있는 혜택으로 읽힌다.
 */
export function CultureEventCard({
  event,
  ended = false,
}: {
  event: CardData;
  ended?: boolean;
}) {
  return (
    <Link href={`/culture-events/${event.slug}`} className="group block">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-deep">
        {event.thumbnailUrl ? (
          <img
            src={event.thumbnailUrl}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-headline text-lg font-black tracking-widest text-white/55">
              STAGE
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 bg-ink/70 px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          {event.type}
        </span>
        {ended ? (
          <span className="absolute right-2 top-2 bg-ink/80 px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            공연 종료
          </span>
        ) : (
          event.memberDiscount > 0 && (
            <span className="absolute right-2 top-2 bg-terra px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-white">
              회원 {event.memberDiscount}%
            </span>
          )
        )}
      </div>
      <div className="mt-3">
        {event.genre.length > 0 && (
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-gold-deep">
            {event.genre.join(" · ")}
          </span>
        )}
        <h3 className="mt-1 line-clamp-2 font-semibold text-ink transition-colors group-hover:text-terra">
          {event.title}
        </h3>
        <div className="mt-1 text-sm text-taupe">
          {event.venue && <span>{event.venue}</span>}
        </div>
        <div className="mt-0.5 font-label text-xs tracking-wide text-date">
          {dateRange(event.startDate, event.endDate)}
        </div>
      </div>
    </Link>
  );
}

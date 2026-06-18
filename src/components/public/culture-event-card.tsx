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

export function CultureEventCard({ event }: { event: CardData }) {
  return (
    <Link href={`/culture-events/${event.slug}`} className="group block">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100">
        {event.thumbnailUrl ? (
          <img
            src={event.thumbnailUrl}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
            <span className="text-lg font-bold tracking-widest text-white/80">
              STAGE
            </span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {event.type}
        </span>
        {event.memberDiscount > 0 && (
          <span className="absolute right-2 top-2 rounded bg-[#6f5c24] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            회원 {event.memberDiscount}%
          </span>
        )}
      </div>
      <div className="mt-3">
        {event.genre.length > 0 && (
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-[#6f5c24]">
            {event.genre.join(" · ")}
          </span>
        )}
        <h3 className="mt-1 font-semibold line-clamp-2 group-hover:underline">
          {event.title}
        </h3>
        <div className="mt-1 text-sm text-gray-500">
          {event.venue && <span>{event.venue}</span>}
        </div>
        <div className="mt-0.5 text-sm text-gray-400">
          {dateRange(event.startDate, event.endDate)}
        </div>
      </div>
    </Link>
  );
}

import Link from "next/link";

interface Magazine {
  id: string;
  issueNumber: number;
  title: string;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  contentType: string;
}

// v2 매거진 아카이브 (page-home §G): 가로 스크롤 한 줄(폭에 맞게 보이는 만큼 노출,
// 나머지는 스크롤). 줄바꿈 없이 항상 한 줄 유지. 전체는 /magazines로.
export function PastMagazines({ magazines }: { magazines: Magazine[] }) {
  if (magazines.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2.5">
        <h2 className="font-label text-[13px] font-bold uppercase tracking-[0.2em] text-ink">
          매거진 아카이브
        </h2>
        <Link
          href="/magazines"
          className="font-label text-[11px] text-gold-deep transition-colors hover:underline"
        >
          전체보기 →
        </Link>
      </div>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {magazines.map((mag) => (
          <Link
            key={mag.id}
            href={`/magazines/${mag.id}`}
            className="group w-[120px] flex-shrink-0"
          >
            <div className="relative mb-2 aspect-[3/4] overflow-hidden bg-ink-deep">
              {mag.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mag.coverImageUrl}
                  alt={mag.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-headline text-sm font-black text-white/30">
                    STAGE
                  </span>
                </div>
              )}
              {mag.contentType !== "image" && (
                <span className="absolute right-1 top-1 rounded-sm bg-teal/90 px-1 py-0.5 font-label text-[7px] font-bold tracking-wide text-white">
                  WEB
                </span>
              )}
            </div>
            <h5 className="line-clamp-1 text-[11px] font-medium text-ink transition-colors group-hover:text-gold-deep">
              {mag.title}
            </h5>
            <div className="mt-0.5 font-label text-[8px] tracking-wide text-date">
              Vol.{String(mag.issueNumber).padStart(2, "0")}
              {mag.publishedAt &&
                ` · ${new Date(mag.publishedAt).getFullYear()}.${String(
                  new Date(mag.publishedAt).getMonth() + 1,
                ).padStart(2, "0")}`}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

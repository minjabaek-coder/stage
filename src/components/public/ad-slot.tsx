import { prisma } from "@/lib/prisma";
import { AdImpression } from "@/components/public/ad-impression";

// 공개 광고 슬롯. placement·isActive·노출기간(start/end)에 맞는 활성 광고 1건을 렌더.
// 매칭 광고가 없으면 아무것도 렌더하지 않는다. (노출/클릭 트래킹은 후속 단계)
export async function AdSlot({
  placement,
  className,
}: {
  placement: string;
  className?: string;
}) {
  const now = new Date();
  const ad = await prisma.advertisement.findFirst({
    where: {
      isActive: true,
      placement: { has: placement },
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!ad) return null;

  return (
    <aside className={className}>
      <AdImpression id={ad.id} />
      <a
        href={`/api/ads/${ad.id}/click`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="group flex items-center gap-5 overflow-hidden rounded-2xl border border-[#1c1b1b]/10 bg-[#f6f3f2] p-4 transition-colors hover:border-[#6f5c24]/40"
      >
        {ad.imageUrl && (
          <div className="relative hidden aspect-[16/9] w-40 flex-shrink-0 overflow-hidden rounded-lg sm:block">
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[#6f5c24]">
            광고 · {ad.sponsor}
          </span>
          <p className="mt-1 font-headline text-xl leading-snug group-hover:text-[#6f5c24]">
            {ad.title}
          </p>
          {ad.description && (
            <p className="mt-1 line-clamp-1 text-sm text-[#444748]">
              {ad.description}
            </p>
          )}
        </div>
        <span className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24] opacity-0 transition-opacity group-hover:opacity-100">
          보기 →
        </span>
      </a>
    </aside>
  );
}

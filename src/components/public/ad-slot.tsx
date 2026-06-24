import { prisma } from "@/lib/prisma";
import { AdImpression } from "@/components/public/ad-impression";

// 공개 광고 슬롯. placement·isActive·노출기간(start/end)에 맞는 활성 광고 1건을 렌더.
// 이미지 소재만 노출(스폰서·제목·설명은 소재 안에). 이미지 없는 광고는 노출하지 않음.
// 'AD' 라벨은 표시광고법상 광고 식별 표시.
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
      imageUrl: { not: null },
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!ad || !ad.imageUrl) return null;

  return (
    <aside className={className}>
      <AdImpression id={ad.id} />
      <a
        href={`/api/ads/${ad.id}/click`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="group relative block overflow-hidden rounded-2xl border border-ink/10 transition-colors hover:border-gold-deep/40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ad.imageUrl}
          alt={ad.title || ad.sponsor}
          className="block w-full"
        />
        <span className="absolute right-2 top-2 rounded bg-black/45 px-1.5 py-0.5 font-label text-[9px] uppercase tracking-wider text-white/75">
          AD
        </span>
      </a>
    </aside>
  );
}

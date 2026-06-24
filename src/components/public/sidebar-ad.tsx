"use client";

import { useEffect, useRef, useState } from "react";

export type SidebarAdItem = {
  id: string;
  sponsor: string;
  title: string;
  imageUrl: string | null;
};

// 사이드바 광고 위젯: 이미지 소재만 노출(스폰서·제목·문구는 소재 안에). 여러 광고는
// 30초 간격 로테이션. 노출 시 1회 카운팅, 클릭은 /api/ads/[id]/click(302 → 링크)로 위임.
// 'AD' 라벨은 표시광고법상 광고 식별 표시(소재와 별개로 플랫폼이 보장).
export function SidebarAd({ ads }: { ads: SidebarAdItem[] }) {
  const withImage = ads.filter((a) => a.imageUrl);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (withImage.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % withImage.length);
    }, 30_000);
    return () => clearInterval(t);
  }, [withImage.length]);

  const ad = withImage[index];
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ad || firedFor.current === ad.id) return;
    firedFor.current = ad.id;
    fetch(`/api/ads/${ad.id}/impression`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [ad]);

  if (!ad || !ad.imageUrl) return null;

  return (
    <a
      href={`/api/ads/${ad.id}/click`}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[9px] border border-ink/[0.08]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.imageUrl}
        alt={ad.title || ad.sponsor}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="absolute right-1.5 top-1.5 rounded bg-black/45 px-1.5 py-0.5 font-label text-[8px] uppercase tracking-wider text-white/75">
        AD
      </span>
      {withImage.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
          {withImage.map((a, i) => (
            <span
              key={a.id}
              className={`h-1 w-1 rounded-full ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </a>
  );
}

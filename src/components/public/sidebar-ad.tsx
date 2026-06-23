"use client";

import { useEffect, useRef, useState } from "react";

export type SidebarAdItem = {
  id: string;
  sponsor: string;
  title: string;
  imageUrl: string | null;
};

// 사이드바 광고 위젯: 여러 광고를 30초 간격으로 로테이션. 노출 시 1회 카운팅,
// 클릭은 /api/ads/[id]/click(302 → 링크)로 위임.
export function SidebarAd({ ads }: { ads: SidebarAdItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, 30_000);
    return () => clearInterval(t);
  }, [ads.length]);

  const ad = ads[index];
  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ad || firedFor.current === ad.id) return;
    firedFor.current = ad.id;
    fetch(`/api/ads/${ad.id}/impression`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [ad]);

  if (!ad) return null;

  return (
    <div className="rounded-[9px] border border-ink/[0.08] bg-widget-bg p-3">
      <a
        href={`/api/ads/${ad.id}/click`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="group block"
      >
        {ad.imageUrl && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}
        <div className="mt-2">
          <span className="font-label text-[9px] font-bold uppercase tracking-[0.15em] text-gold-deep">
            광고 · {ad.sponsor}
          </span>
          <p className="mt-0.5 line-clamp-2 font-headline text-sm leading-snug text-ink group-hover:text-gold-deep">
            {ad.title}
          </p>
        </div>
      </a>
      <div className="mt-2 flex items-center justify-between">
        {ads.length > 1 && (
          <div className="flex gap-1">
            {ads.map((a, i) => (
              <span
                key={a.id}
                className={`h-1 w-1 rounded-full ${
                  i === index ? "bg-gold-deep" : "bg-ink/20"
                }`}
              />
            ))}
          </div>
        )}
        <a
          href="/contact"
          className="ml-auto font-label text-[9px] uppercase tracking-wider text-ink/40 hover:text-gold-deep"
        >
          광고 문의
        </a>
      </div>
    </div>
  );
}

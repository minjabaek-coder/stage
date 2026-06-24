"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStageOsBannerPublic } from "@/actions/site-settings-actions";
import type { StageOsBannerConfig } from "@/lib/site-settings";

const DISMISS_KEY = "stageos-banner-dismissed";

// StageOS 프로모 배너 (v2 global-chrome §2, B 서브브랜드): 닫기 가능 + 어드민 설정형.
// 카피/링크/노출은 SiteSetting(stageos_banner)에서 관리(/admin/settings).
// 재노출 정책은 세션 단위(sessionStorage).
export function StageOsBanner() {
  // 초기엔 숨김(세션 확인·설정 로드 전 깜빡임 방지) → 마운트 후 결정
  const [dismissed, setDismissed] = useState(true);
  const [config, setConfig] = useState<StageOsBannerConfig | null>(null);

  useEffect(() => {
    let alive = true;
    // 마운트 후 세션 스토리지 1회 동기화(SSR 깜빡임 방지) — 의도된 패턴
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    getStageOsBannerPublic().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (dismissed || !config || !config.enabled) return null;

  return (
    <div className="relative overflow-hidden border-b border-os-purple/20 bg-[linear-gradient(135deg,#0a0f1a_0%,#111827_50%,#0d1520_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(99,102,241,0.12)_0%,transparent_60%)]" />
      <div className="relative z-[1] mx-auto flex max-w-[1380px] items-center justify-between gap-3 px-3 py-2.5 sm:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] text-sm text-white">
            ✦
          </span>
          <div className="min-w-0">
            <div className="font-label text-[8px] uppercase tracking-[3px] text-os-purple-light/70">
              {config.eyebrow}
            </div>
            <div className="truncate font-headline text-[13px] font-bold text-white sm:text-[15px]">
              {config.headline}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href={config.ctaHref}
            className="whitespace-nowrap rounded-md bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-3.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
          >
            {config.ctaLabel}
          </Link>
          <button
            type="button"
            aria-label="StageOS 배너 닫기"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="text-base leading-none text-white/30 transition-colors hover:text-white/60"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

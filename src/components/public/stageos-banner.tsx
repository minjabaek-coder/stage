"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "stageos-banner-dismissed";

// StageOS 프로모 배너 (v2 global-chrome §2, B 서브브랜드): 닫기 가능.
// 재노출 정책은 세션 단위(sessionStorage) — 영구/N일 정책은 후속.
export function StageOsBanner() {
  // 초기엔 숨김(세션 확인 전 깜빡임 방지) → 마운트 후 결정
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

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
              Coming Soon · StageOS
            </div>
            <div className="truncate font-headline text-[13px] font-bold text-white sm:text-[15px]">
              문화예술 기관을 위한 AI 운영 플랫폼 — 모바일 브로셔 · 음성 해설 ·
              관객 분석 · AI 마에스트로 API
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href="/stageos"
            className="whitespace-nowrap rounded-md bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] px-3.5 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
          >
            얼리 액세스 신청 →
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

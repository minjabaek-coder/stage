"use client";

import { useState, useEffect } from "react";
import { MagazineViewer } from "./magazine-viewer";
import { PagedMagazineViewer } from "./magazine-viewer-paged";
import type { MagazinePage, MagazineTocEntry } from "@/types/magazine";

type ViewMode = "flip" | "paged";
const STORAGE_KEY = "magazine:viewMode";

// 플립(react-pageflip)과 버튼 기반 페이지 뷰어를 토글로 전환하는 래퍼.
// 평가용: 사용자가 두 방식을 비교하고 선호를 localStorage에 저장.
export function MagazineReader({
  pages,
  magazineId,
  tocEntries = [],
  initialPage = 1,
}: {
  pages: MagazinePage[];
  magazineId?: string;
  tocEntries?: MagazineTocEntry[];
  initialPage?: number; // 1-based, ?page= 딥링크 진입 페이지
}) {
  const [mode, setMode] = useState<ViewMode>("flip");

  // 마운트 후 저장된 선호를 반영 (SSR은 항상 "flip"으로 렌더 → 하이드레이션 일치 유지)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "flip" || saved === "paged") setMode(saved);
  }, []);

  function change(next: ViewMode) {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage 비활성 환경 무시
    }
  }

  return (
    <div className="relative h-full">
      {/* 모드 토글 */}
      <div className="absolute left-1/2 top-2 z-[70] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/15 bg-ink/70 p-0.5 backdrop-blur-sm">
        <button
          onClick={() => change("flip")}
          aria-pressed={mode === "flip"}
          className={`rounded-full px-3 py-1 font-label text-xs uppercase tracking-wider transition-colors ${
            mode === "flip"
              ? "bg-gold text-ink"
              : "text-white/60 hover:text-white"
          }`}
        >
          넘기기
        </button>
        <button
          onClick={() => change("paged")}
          aria-pressed={mode === "paged"}
          className={`rounded-full px-3 py-1 font-label text-xs uppercase tracking-wider transition-colors ${
            mode === "paged"
              ? "bg-gold text-ink"
              : "text-white/60 hover:text-white"
          }`}
        >
          페이지
        </button>
      </div>

      {mode === "flip" ? (
        <MagazineViewer
          pages={pages}
          magazineId={magazineId}
          tocEntries={tocEntries}
          initialPage={initialPage}
        />
      ) : (
        <PagedMagazineViewer
          pages={pages}
          magazineId={magazineId}
          tocEntries={tocEntries}
          initialPage={initialPage}
        />
      )}
    </div>
  );
}

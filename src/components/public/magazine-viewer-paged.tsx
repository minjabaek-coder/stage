"use client";

import { useState, useEffect, useCallback } from "react";
// Using native <img> to avoid Vercel Image Optimization limits
import type { MagazinePage, MagazineTocEntry } from "@/types/magazine";
import { TocPanel, TocThumbnailStrip } from "./magazine-viewer";
import { ComposedPage } from "./composed-page";
import { parsePageLayout } from "@/types/magazine-layout";

// 버튼/클릭 기반 페이지 뷰어 (플립 애니메이션 없음).
// - 좌/우 클릭 영역 + 명시적 ← → 버튼 + 키보드 화살표로 한 페이지씩 이동
// - 데스크톱·모바일 동일 동작 (스와이프 대신 버튼 중심)
export function PagedMagazineViewer({
  pages,
  tocEntries = [],
}: {
  pages: MagazinePage[];
  magazineId?: string;
  tocEntries?: MagazineTocEntry[];
}) {
  const [index, setIndex] = useState(0); // 0-based 페이지 인덱스
  const [isMobile, setIsMobile] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const hasToc = tocEntries.length > 0;
  const total = pages.length;

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const canPrev = index > 0;
  const canNext = index < total - 1;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total]
  );
  const goToPage = useCallback(
    (pageNumber: number) =>
      setIndex(Math.min(total - 1, Math.max(0, pageNumber - 1))),
    [total]
  );

  // 키보드 화살표
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  // 인접 페이지 프리로드 (전환 체감 속도 향상)
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const p = pages[i];
      if (p && p.imageUrl) {
        const im = new window.Image();
        im.src = p.imageUrl;
      }
    });
  }, [index, pages]);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        페이지가 없습니다.
      </div>
    );
  }

  const current = pages[index];

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-900">
        {/* 현재 페이지: 이미지형 또는 구성형 */}
        {current.kind === "composed" ? (
          <ComposedPage key={current.id} layout={parsePageLayout(current.layout)} />
        ) : (
          <img
            key={current.id}
            src={current.imageUrl ?? ""}
            alt={`Page ${current.pageNumber}`}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
          />
        )}

        {/* 좌측 클릭 영역 (이전) */}
        <button
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="이전 페이지"
          className="group absolute left-0 top-0 flex h-full w-1/4 items-center justify-start pl-2 disabled:cursor-default md:w-1/3 md:pl-4"
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl text-white backdrop-blur-sm transition-opacity ${
              canPrev
                ? "opacity-60 group-hover:opacity-100"
                : "opacity-0"
            }`}
          >
            &larr;
          </span>
        </button>

        {/* 우측 클릭 영역 (다음) */}
        <button
          onClick={goNext}
          disabled={!canNext}
          aria-label="다음 페이지"
          className="group absolute right-0 top-0 flex h-full w-1/4 items-center justify-end pr-2 disabled:cursor-default md:w-1/3 md:pr-4"
        >
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-2xl text-white backdrop-blur-sm transition-opacity ${
              canNext
                ? "opacity-60 group-hover:opacity-100"
                : "opacity-0"
            }`}
          >
            &rarr;
          </span>
        </button>

        {/* 목차 버튼 */}
        {hasToc && !tocOpen && (
          <button
            onClick={() => setTocOpen(true)}
            className="absolute right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-lg text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            title="목차"
          >
            ☰
          </button>
        )}

        {hasToc && (
          <TocPanel
            tocEntries={tocEntries}
            pages={pages}
            currentPage={index}
            isOpen={tocOpen}
            onClose={() => setTocOpen(false)}
            onNavigate={(pageNumber) => {
              goToPage(pageNumber);
              setTocOpen(false);
            }}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* 데스크톱 목차 썸네일 스트립 */}
      {!isMobile && hasToc && (
        <TocThumbnailStrip
          tocEntries={tocEntries}
          pages={pages}
          currentPage={index}
          onNavigate={goToPage}
        />
      )}

      {/* 하단 버튼 컨트롤 (모바일·데스크톱 공통) */}
      <div className="flex flex-shrink-0 items-center justify-center gap-4 py-3">
        <button
          onClick={goPrev}
          disabled={!canPrev}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 text-lg text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-30"
        >
          &larr;
        </button>
        <span className="min-w-[80px] text-center text-sm text-gray-400">
          {index + 1} / {total}
        </span>
        <button
          onClick={goNext}
          disabled={!canNext}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 text-lg text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-30"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}

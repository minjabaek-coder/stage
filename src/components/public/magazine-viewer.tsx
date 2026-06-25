"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  type CSSProperties,
} from "react";
import Link from "next/link";
// Using native <img> to avoid Vercel Image Optimization limits
import type { MagazinePage, MagazineTocEntry } from "@/types/magazine";
import { ComposedPage } from "./composed-page";
import { MagazineZoomLightbox } from "./magazine-zoom-lightbox";
import { parsePageLayout } from "@/types/magazine-layout";

// 페이지 본문: 이미지형은 <img>, 구성형(39호+)은 ComposedPage로 렌더.
function PageBody({
  page,
  imgClassName,
}: {
  page: MagazinePage;
  imgClassName: string;
}) {
  if (page.kind === "composed") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <ComposedPage layout={parsePageLayout(page.layout)} />
      </div>
    );
  }
  return (
    <img
      src={page.imageUrl ?? ""}
      alt={`Page ${page.pageNumber}`}
      className={imgClassName}
      draggable={false}
    />
  );
}

// ── Pinch-to-zoom hook (mobile only) ──
function usePinchZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  callbacks?: {
    onSingleTap?: (clientX: number) => void;
    onSwipePrev?: () => void;
    onSwipeNext?: () => void;
  },
  enabled: boolean = false,
) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pinchRef = useRef<{
    initialDistance: number;
    initialScale: number;
    midX: number;
    midY: number;
    lastMidX: number;
    lastMidY: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didMoveRef = useRef(false);
  const wasPinchingRef = useRef(false);
  const callbacksRef = useRef(callbacks);
  // Keep the latest callbacks for the gesture handlers without re-subscribing;
  // assign after commit (no deps = every render) instead of during render.
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const isZoomed = scale > 1.05;

  const resetZoom = useCallback(() => {
    stateRef.current = { scale: 1, tx: 0, ty: 0 };
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      const el = containerRef.current;
      if (!el || s <= 1) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const maxX = (rect.width * (s - 1)) / 2;
      const maxY = (rect.height * (s - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, tx)),
        y: Math.max(-maxY, Math.min(maxY, ty)),
      };
    },
    [containerRef]
  );

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    function dist(t1: Touch, t2: Touch) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        wasPinchingRef.current = true;
        const d = dist(e.touches[0], e.touches[1]);
        pinchRef.current = {
          initialDistance: d,
          initialScale: stateRef.current.scale,
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          lastMidX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          lastMidY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        panRef.current = null;
        didMoveRef.current = true;
      } else if (e.touches.length === 1) {
        // Block ALL 1-finger events from reaching react-pageflip on mobile
        e.stopPropagation();
        touchStartPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        didMoveRef.current = false;
        if (stateRef.current.scale > 1.05) {
          e.preventDefault();
          panRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            startTx: stateRef.current.tx,
            startTy: stateRef.current.ty,
          };
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      // Block ALL 1-finger moves from reaching react-pageflip
      if (e.touches.length === 1) {
        e.stopPropagation();
      }
      if (e.touches.length === 1 && touchStartPosRef.current && !didMoveRef.current) {
        const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) didMoveRef.current = true;
      }
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const d = dist(e.touches[0], e.touches[1]);
        const newScale = Math.max(
          1,
          Math.min(4, pinchRef.current.initialScale * (d / pinchRef.current.initialDistance))
        );
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dx = midX - pinchRef.current.lastMidX;
        const dy = midY - pinchRef.current.lastMidY;
        pinchRef.current.lastMidX = midX;
        pinchRef.current.lastMidY = midY;

        const newTx = stateRef.current.tx + dx;
        const newTy = stateRef.current.ty + dy;
        const clamped = clampTranslate(newTx, newTy, newScale);

        stateRef.current = { scale: newScale, tx: clamped.x, ty: clamped.y };
        setScale(newScale);
        setTranslate(clamped);
      } else if (e.touches.length === 1 && panRef.current && stateRef.current.scale > 1.05) {
        e.preventDefault();
        const dx = e.touches[0].clientX - panRef.current.startX;
        const dy = e.touches[0].clientY - panRef.current.startY;
        const newTx = panRef.current.startTx + dx;
        const newTy = panRef.current.startTy + dy;
        const clamped = clampTranslate(newTx, newTy, stateRef.current.scale);

        stateRef.current.tx = clamped.x;
        stateRef.current.ty = clamped.y;
        setTranslate(clamped);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        e.stopPropagation();
        pinchRef.current = null;
      }
      if (e.touches.length === 0) {
        wasPinchingRef.current = false;
        panRef.current = null;
        // Snap back to 1 if barely zoomed
        if (stateRef.current.scale < 1.1) {
          stateRef.current = { scale: 1, tx: 0, ty: 0 };
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        }

        // Gesture detection: tap or swipe
        const isTap = !didMoveRef.current;
        if (isTap) {
          // Prevent browser from synthesizing a click event (ghost click)
          e.preventDefault();
          if (stateRef.current.scale > 1.05) {
            // Zoomed → single tap resets zoom
            stateRef.current = { scale: 1, tx: 0, ty: 0 };
            setScale(1);
            setTranslate({ x: 0, y: 0 });
          } else {
            // Not zoomed → single tap callback (탭 영역 판정용 X 전달)
            const tapX =
              e.changedTouches[0]?.clientX ?? touchStartPosRef.current?.x ?? 0;
            callbacksRef.current?.onSingleTap?.(tapX);
          }
        } else if (touchStartPosRef.current && stateRef.current.scale <= 1.05) {
          // Swipe detection (only when not zoomed)
          const endX = e.changedTouches[0]?.clientX ?? 0;
          const dx = endX - touchStartPosRef.current.x;
          const SWIPE_THRESHOLD = 50;
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            e.preventDefault();
            e.stopPropagation();
            if (dx > 0) {
              // Swipe left→right = previous page
              callbacksRef.current?.onSwipePrev?.();
            } else {
              // Swipe right→left = next page
              callbacksRef.current?.onSwipeNext?.();
            }
          }
        }
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false, capture: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    el.addEventListener("touchend", onTouchEnd, { capture: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart, { capture: true });
      el.removeEventListener("touchmove", onTouchMove, { capture: true });
      el.removeEventListener("touchend", onTouchEnd, { capture: true });
    };
  }, [containerRef, clampTranslate, enabled]);

  return { scale, translate, isZoomed, resetZoom };
}

// ── Lazy load react-pageflip ──
function useFlipBook() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Component, setComponent] = useState<any>(null);
  useEffect(() => {
    import("react-pageflip").then((mod) => {
      setComponent(() => mod.default || mod);
    });
  }, []);
  return Component;
}

const FlipPage = forwardRef<
  HTMLDivElement,
  { page: MagazinePage; style?: CSSProperties }
>(function FlipPage({ page, style }, ref) {
  return (
    <div
      ref={ref}
      style={style}
      className="relative h-full w-full overflow-hidden bg-ink-deep"
    >
      <PageBody
        page={page}
        imgClassName="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
});

// ── Mobile prev flip overlay (CSS 3D) ──
// Renders on top of react-pageflip when going prev on mobile
function MobilePrevFlipOverlay({
  prevPage,
  currentPage,
  pageW,
  pageH,
  onComplete,
}: {
  prevPage: MagazinePage;
  currentPage: MagazinePage;
  pageW: number;
  pageH: number;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const animRef = useRef<number>(0);
  const DURATION = 600;

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / DURATION, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setProgress(eased);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [onComplete]);

  // Previous page flips in from the left: starts at rotateY(180deg), ends at rotateY(0)
  const angle = 180 - progress * 180;

  return (
    <div
      className="absolute inset-0 z-50"
      style={{ perspective: "1200px", width: pageW, height: pageH }}
    >
      {/* Current page visible underneath */}
      <div className="absolute inset-0 overflow-hidden bg-ink-deep">
        <PageBody
          page={currentPage}
          imgClassName="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      {/* Previous page flipping in from the left */}
      <div
        className="absolute inset-0 overflow-hidden bg-ink-deep"
        style={{
          transformOrigin: "right center",
          transform: `rotateY(${-angle}deg)`,
          backfaceVisibility: "hidden",
          zIndex: angle < 90 ? 2 : 0,
        }}
      >
        <PageBody
          page={prevPage}
          imgClassName="absolute inset-0 h-full w-full object-contain"
        />
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: (angle / 180) * 0.35 }}
        />
      </div>

      {/* Shadow on current page from lifted prev page */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to left, rgba(0,0,0,${0.25 * Math.sin((progress) * Math.PI)}) 0%, transparent 50%)`,
          zIndex: 1,
        }}
      />
    </div>
  );
}

// ── TOC Panel (Desktop: side panel, Mobile: bottom carousel modal) ──
export function TocPanel({
  tocEntries,
  pages,
  currentPage,
  isOpen,
  onClose,
  onNavigate,
  isMobile,
}: {
  tocEntries: MagazineTocEntry[];
  pages: MagazinePage[];
  currentPage: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (pageNumber: number) => void;
  isMobile: boolean;
}) {
  const activeCardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [isOpen, currentPage]);

  if (!isOpen) return null;

  if (isMobile) {
    // 하단 시트 + 세로 리스트(썸네일 + 제목 + 쪽) — 데스크톱과 통일된 리스트
    return (
      <>
        <div className="fixed inset-0 z-[99] bg-black/40" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 z-[100] max-h-[62%] overflow-hidden rounded-t-2xl bg-ink/95 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-sm">
          <div className="mx-auto mb-1 mt-2 h-1 w-10 rounded-full bg-white/25" />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
              목차
            </span>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="text-lg leading-none text-white/50"
            >
              ✕
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-2 pb-2">
            {tocEntries.map((entry) => {
              const page = pages.find((p) => p.pageNumber === entry.pageNumber);
              const isActive = currentPage + 1 === entry.pageNumber;
              return (
                <button
                  key={entry.id}
                  ref={isActive ? activeCardRef : undefined}
                  onClick={() => {
                    onNavigate(entry.pageNumber);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-gold/15" : "active:bg-white/10"
                  }`}
                >
                  <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-ink-deep">
                    {page &&
                      (page.kind === "composed" ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ComposedPage layout={parsePageLayout(page.layout)} />
                        </div>
                      ) : (
                        <img
                          src={page.imageUrl ?? ""}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] ${
                        isActive ? "text-white" : "text-white/80"
                      }`}
                    >
                      {entry.title}
                    </span>
                    <span className="font-label text-[11px] text-gold">
                      p.{entry.pageNumber}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // Desktop: side panel
  return (
    <div className="absolute right-0 top-0 bottom-0 z-50 flex w-72 flex-col border-l border-white/10 bg-ink/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-gold">목차</span>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tocEntries.map((entry) => {
          const isActive = currentPage + 1 === entry.pageNumber;
          const page = pages.find((p) => p.pageNumber === entry.pageNumber);
          return (
            <button
              key={entry.id}
              onClick={() => onNavigate(entry.pageNumber)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? "bg-gold/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate">{entry.title}</span>
                <span className="font-label text-xs text-white/40">p.{entry.pageNumber}</span>
              </div>
              {page && (
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded">
                  {page.kind === "composed" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink-deep">
                      <ComposedPage layout={parsePageLayout(page.layout)} />
                    </div>
                  ) : (
                    <img
                      src={page.imageUrl ?? ""}
                      alt={entry.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MagazineViewer({
  pages,
  tocEntries = [],
  initialPage = 1,
  issueNumber,
  title,
}: {
  pages: MagazinePage[];
  tocEntries?: MagazineTocEntry[];
  initialPage?: number; // 1-based, ?page= 딥링크 진입 페이지
  issueNumber?: number;
  title?: string;
}) {
  const HTMLFlipBook = useFlipBook();
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 리더 배경 다크/라이트 토글(◐) + 풀스크린(⛶)
  const [dark, setDark] = useState(true);
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);
  const [dims, setDims] = useState<{
    pageW: number;
    pageH: number;
    wrapW: number;
    wrapH: number;
    isMobile: boolean;
    single: boolean; // 한 페이지(단면) 표시 여부 = 모바일 || 한 페이지 토글
  } | null>(null);
  // ?page= 딥링크 → 0-based 인덱스로 보정(범위 클램프)
  const startIndex = Math.min(Math.max(0, initialPage - 1), Math.max(0, pages.length - 1));
  const [currentPage, setCurrentPage] = useState(startIndex);
  const [isPortrait, setIsPortrait] = useState(false);
  // 데스크톱 한/두 페이지 토글(rev.3). 두 페이지=양면 스프레드, 한 페이지=단면 확대.
  const [forceSingle, setForceSingle] = useState(false);
  const pageRatioRef = useRef(2 / 3); // STAGE 지면 기본 2:3 (이미지 측정 시 보정)

  // Pinch-to-zoom (mobile)
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const ready = HTMLFlipBook && dims;
  const [tocOpen, setTocOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const hasToc = tocEntries.length > 0;
  // 모바일 오버레이(헤더·하단 컨트롤) 표시 — 탭으로 토글(자동숨김, rev.3 모바일)
  const [overlayVisible, setOverlayVisible] = useState(true);

  // 넘김 효과 토글(#6): off면 즉시 전환(단면 역넘김 어색함 회피 #3)
  const [flipEffect, setFlipEffect] = useState(true);

  // 데스크톱 인라인 줌(#5): 휠/슬라이더/더블클릭 + 드래그 팬. 스프레드 전체가 함께 확대(#4)
  const [deskScale, setDeskScale] = useState(1);
  const [deskTrans, setDeskTrans] = useState({ x: 0, y: 0 });
  const clampDesk = useCallback((x: number, y: number, s: number) => {
    const el = zoomContainerRef.current;
    if (!el || s <= 1) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const maxX = (r.width * (s - 1)) / 2;
    const maxY = (r.height * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);
  const setDeskZoom = useCallback(
    (s: number) => {
      const ns = Math.max(1, Math.min(3, s));
      setDeskScale(ns);
      setDeskTrans((t) => clampDesk(t.x, t.y, ns));
    },
    [clampDesk],
  );
  const resetDeskZoom = useCallback(() => {
    setDeskScale(1);
    setDeskTrans({ x: 0, y: 0 });
  }, []);

  // 현재 페이지 확대 가능 여부 — 이미지형(URL 있음) 또는 구성형 모두 지원
  const currentPageObj = pages[currentPage];
  const canZoom =
    !!currentPageObj &&
    (currentPageObj.kind === "composed" || !!currentPageObj.imageUrl);

  const flipPrevRef = useRef<() => void>(undefined);
  const flipNextRef = useRef<() => void>(undefined);

  const { scale: zoomScale, translate: zoomTranslate, isZoomed, resetZoom } = usePinchZoom(
    zoomContainerRef,
    {
      // 탭 영역: 좌 1/3=이전, 우 1/3=다음, 가운데=오버레이 토글
      onSingleTap: (clientX: number) => {
        const el = zoomContainerRef.current;
        if (!el) {
          setOverlayVisible((v) => !v);
          return;
        }
        const r = el.getBoundingClientRect();
        const rel = (clientX - r.left) / r.width;
        if (rel < 0.33) flipPrevRef.current?.();
        else if (rel > 0.67) flipNextRef.current?.();
        else setOverlayVisible((v) => !v);
      },
      onSwipePrev: () => flipPrevRef.current?.(),
      onSwipeNext: () => flipNextRef.current?.(),
    },
    !!ready,
  );

  const navigateToPage = useCallback(
    (pageNumber: number) => {
      const pf = bookRef.current?.pageFlip();
      if (pf) {
        pf.turnToPage(pageNumber - 1);
      }
    },
    []
  );

  // Mobile prev flip overlay state
  const [mobilePrevFlip, setMobilePrevFlip] = useState<{
    prevPage: MagazinePage;
    currentPage: MagazinePage;
  } | null>(null);

  // Load actual image ratio from first page, then compute dimensions
  useEffect(() => {
    let cancelled = false;

    function computeDims() {
      if (!containerRef.current) return;
      const { width: cw, height: ch } =
        containerRef.current.getBoundingClientRect();
      if (cw === 0 || ch === 0) return;

      const PAGE_RATIO = pageRatioRef.current;
      const isMobile = cw < 768;
      const single = isMobile || forceSingle; // 모바일 또는 '한 페이지' 토글

      if (isMobile) {
        // 모바일: 폭 가득, 높이는 비율
        const pageW = Math.floor(cw);
        const pageH = Math.floor(cw / PAGE_RATIO);
        setDims({ pageW, pageH, wrapW: pageW, wrapH: pageH, isMobile: true, single: true });
      } else if (single) {
        // 데스크톱 '한 페이지'(단면): 높이에 맞추되 폭으로 캡
        let pageH = Math.floor(ch);
        let pageW = Math.floor(pageH * PAGE_RATIO);
        if (pageW > cw) {
          pageW = Math.floor(cw);
          pageH = Math.floor(pageW / PAGE_RATIO);
        }
        setDims({ pageW, pageH, wrapW: pageW, wrapH: pageH, isMobile: false, single: true });
      } else {
        // 데스크톱 '두 페이지'(양면 스프레드)
        const bookWIfH = 2 * ch * PAGE_RATIO;
        let pageW: number, pageH: number;
        if (bookWIfH <= cw) {
          pageH = Math.floor(ch);
          pageW = Math.floor(ch * PAGE_RATIO);
        } else {
          pageW = Math.floor(cw / 2);
          pageH = Math.floor(pageW / PAGE_RATIO);
        }
        setDims({ pageW, pageH, wrapW: pageW * 2, wrapH: pageH, isMobile: false, single: false });
      }
    }

    const first = pages[0];
    if (first && first.kind !== "composed" && first.imageUrl) {
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          pageRatioRef.current = img.naturalWidth / img.naturalHeight;
        }
        computeDims();
      };
      img.onerror = () => {
        if (!cancelled) computeDims();
      };
      img.src = first.imageUrl;
    } else {
      // 구성형(이미지 없음): 2:3 고정 — 1~38호 이미지(1200×1800=2:3)와 동일 비율로
      // 면 크기를 잡아 여백/레이아웃/넘김 효과를 동일하게 유지.
      if (first && first.kind === "composed") pageRatioRef.current = 2 / 3;
      computeDims();
    }

    function onResize() {
      computeDims();
    }

    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [pages, forceSingle]);

  const onFlip = useCallback(
    (e: { data: number }) => {
      setCurrentPage(e.data);
      resetZoom();
      resetDeskZoom();
    },
    [resetZoom, resetDeskZoom]
  );

  const onChangeOrientation = useCallback(
    (e: { data: string }) => {
      setIsPortrait(e.data === "portrait");
    },
    []
  );

  const flipPrev = useCallback(() => {
    if (currentPage <= 0) return;

    if (dims?.isMobile) {
      if (!flipEffect) {
        // 넘김 효과 OFF: 즉시 전환(역방향 CSS 3D 오버레이 생략)
        bookRef.current?.pageFlip()?.turnToPage(currentPage - 1);
      } else {
        // Mobile: use custom CSS 3D flip overlay (left→right)
        setMobilePrevFlip({
          prevPage: pages[currentPage - 1],
          currentPage: pages[currentPage],
        });
      }
    } else if (dims?.single) {
      // 데스크톱 단면(portrait): react-pageflip 역넘김이 불안정(무반응) →
      // turnToPage로 확실히 이전 페이지 이동(단면 역넘김 어색함도 함께 해소)
      bookRef.current?.pageFlip()?.turnToPage(currentPage - 1);
    } else {
      // 데스크톱 양면(스프레드): react-pageflip 역넘김
      const pf = bookRef.current?.pageFlip();
      if (pf) pf.flipPrev("top");
    }
  }, [currentPage, dims?.isMobile, dims?.single, pages, flipEffect]);

  const flipNext = useCallback(() => {
    const pf = bookRef.current?.pageFlip();
    if (!pf) return;
    if (currentPage < pages.length - 1) {
      pf.flipNext("top");
    }
  }, [currentPage, pages.length]);

  // Keep the swipe handlers (in usePinchZoom) pointing at the latest callbacks
  // without re-subscribing. Assign after commit, not during render.
  useEffect(() => {
    flipPrevRef.current = flipPrev;
    flipNextRef.current = flipNext;
  }, [flipPrev, flipNext]);

  const handleMobilePrevComplete = useCallback(() => {
    // Animation done — tell react-pageflip to go to prev page (instant, no animation)
    const pf = bookRef.current?.pageFlip();
    if (pf) {
      pf.turnToPage(currentPage - 1);
    }
    setMobilePrevFlip(null);
  }, [currentPage]);

  // Keyboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") flipPrev();
      if (e.key === "ArrowRight") flipNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flipPrev, flipNext]);

  const total = pages.length;
  const isSingle = dims?.single ?? isPortrait;
  const displayPage = isSingle
    ? `${currentPage + 1}`
    : `${currentPage + 1}-${Math.min(currentPage + 2, total)}`;
  const canPrev = currentPage > 0;
  const canNext = isSingle
    ? currentPage + 1 < total
    : currentPage + 2 < total;

  return (
    <div ref={rootRef} className="relative flex h-full flex-col bg-ink-deep">
      {/* 리더 헤더 (rev.3): STAGE · Issue · 제목 · ✕ 닫기 + 진행률 밑줄.
          모바일은 탭 토글 오버레이(자동숨김), 데스크톱은 정적. */}
      <header
        className={
          dims?.isMobile
            ? `absolute left-0 right-0 top-0 z-40 bg-gradient-to-b from-black/70 to-transparent pt-[env(safe-area-inset-top)] transition-opacity duration-200 ${overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"}`
            : "relative flex-shrink-0"
        }
      >
        <div className="flex h-[52px] items-center justify-between gap-3 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex-shrink-0 font-headline text-lg font-black tracking-[-0.03em] text-white"
            >
              STAGE
            </Link>
            {issueNumber != null && (
              <span className="flex-shrink-0 font-label text-[10px] uppercase tracking-[0.2em] text-gold">
                Issue {String(issueNumber).padStart(2, "0")}
              </span>
            )}
            {title && (
              <span className="hidden truncate font-headline text-sm text-white/80 sm:block">
                {title}
              </span>
            )}
          </div>
          <Link
            href="/magazines"
            aria-label="닫기"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            ✕
          </Link>
        </div>
        {/* 진행률 밑줄 */}
        <div className="h-[2px] w-full bg-white/10">
          <div
            className="h-full bg-gold transition-all duration-300"
            style={{ width: `${total ? ((currentPage + 1) / total) * 100 : 0}%` }}
          />
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="flex flex-1 items-center justify-center overflow-hidden"
          style={{ background: dark ? undefined : "#f6f3f2" }}
        >
        {!ready && <div className="font-label text-sm tracking-wide text-white/40">Loading…</div>}
        {ready && (
          <div
            ref={zoomContainerRef}
            onClick={
              // 넘김 효과 OFF(데스크톱·미줌): 좌측 절반=이전, 우측 절반=다음
              !dims.isMobile && !flipEffect && deskScale <= 1
                ? (e) => {
                    const el = zoomContainerRef.current;
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    if ((e.clientX - r.left) / r.width < 0.5) flipPrev();
                    else flipNext();
                  }
                : undefined
            }
            onDoubleClick={
              // 넘김 효과 ON에서만 더블클릭 줌(OFF는 클릭 이동과 충돌 방지)
              !dims.isMobile && canZoom && flipEffect
                ? () => setDeskZoom(deskScale > 1 ? 1 : 2)
                : undefined
            }
            onWheel={
              !dims.isMobile && canZoom
                ? (e) => setDeskZoom(deskScale + (e.deltaY < 0 ? 0.25 : -0.25))
                : undefined
            }
            style={{
              width: dims.single ? dims.pageW : dims.wrapW,
              height: dims.wrapH,
              touchAction: dims.isMobile ? "none" : "auto",
              cursor:
                !dims.isMobile && !flipEffect && deskScale <= 1
                  ? "pointer"
                  : undefined,
            }}
            className="relative flex-shrink-0"
          >
            <div
              style={{
                transform: dims.isMobile
                  ? zoomScale > 1
                    ? `translate(${zoomTranslate.x}px, ${zoomTranslate.y}px) scale(${zoomScale})`
                    : undefined
                  : deskScale > 1
                    ? `translate(${deskTrans.x}px, ${deskTrans.y}px) scale(${deskScale})`
                    : undefined,
                transformOrigin: "center center",
                width: "100%",
                height: "100%",
                transition: (dims.isMobile ? zoomScale === 1 : deskScale === 1)
                  ? "transform 0.2s ease-out"
                  : undefined,
              }}
            >
            {/*
              react-pageflip is client-only (cannot SSR) and lazy-loaded once via
              useFlipBook; its value changes only null→component and is then stable,
              and bookRef must forward to it to drive pageFlip(). The "static
              components" rule is a false positive for this intentional pattern.
            */}
            {/* eslint-disable-next-line react-hooks/static-components */}
            <HTMLFlipBook
              key={`${dims.single ? "single" : "spread"}-${flipEffect ? "flip" : "instant"}`}
              ref={bookRef}
              width={dims.pageW}
              height={dims.pageH}
              size="fixed"
              minWidth={100}
              maxWidth={2000}
              minHeight={100}
              maxHeight={2000}
              drawShadow={!dims.isMobile}
              maxShadowOpacity={dims.isMobile ? 0 : 0.4}
              showCover={true}
              flippingTime={flipEffect ? (dims.isMobile ? 600 : 800) : 1}
              usePortrait={dims.single}
              startPage={currentPage}
              startZIndex={0}
              autoSize={false}
              mobileScrollSupport={true}
              clickEventForward={false}
              useMouseEvents={true}
              swipeDistance={dims.isMobile ? 9999 : 30}
              showPageCorners={!dims.isMobile}
              disableFlipByClick={true}
              onFlip={onFlip}
              onChangeOrientation={onChangeOrientation}
              className=""
              style={{}}
            >
              {pages.map((page) => (
                <FlipPage key={page.id} page={page} />
              ))}
            </HTMLFlipBook>
            </div>

            {/* 데스크톱 줌 상태: 드래그 팬 오버레이(react-pageflip 위 — 줌 중엔 넘김 잠금) */}
            {!dims.isMobile && deskScale > 1 && (
              <div
                className="absolute inset-0 z-30"
                style={{ cursor: "grab" }}
                onDoubleClick={() => setDeskZoom(1)}
                onWheel={(e) =>
                  setDeskZoom(deskScale + (e.deltaY < 0 ? 0.25 : -0.25))
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  const start = {
                    x: e.clientX,
                    y: e.clientY,
                    tx: deskTrans.x,
                    ty: deskTrans.y,
                  };
                  const move = (ev: MouseEvent) =>
                    setDeskTrans(
                      clampDesk(
                        start.tx + (ev.clientX - start.x),
                        start.ty + (ev.clientY - start.y),
                        deskScale,
                      ),
                    );
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
              />
            )}

            {/* Mobile prev: CSS 3D flip overlay */}
            {mobilePrevFlip && dims.isMobile && (
              <MobilePrevFlipOverlay
                prevPage={mobilePrevFlip.prevPage}
                currentPage={mobilePrevFlip.currentPage}
                pageW={dims.pageW}
                pageH={dims.pageH}
                onComplete={handleMobilePrevComplete}
              />
            )}
          </div>
        )}
        </div>

        {hasToc && (
          // 모바일: 탭=하단 캐러셀 / 데스크톱: 우측 사이드패널
          <TocPanel
            tocEntries={tocEntries}
            pages={pages}
            currentPage={currentPage}
            isOpen={tocOpen}
            onClose={() => setTocOpen(false)}
            onNavigate={navigateToPage}
            isMobile={dims?.isMobile ?? false}
          />
        )}
      </div>

      {/* 모바일 하단 오버레이 (rev.3): 목차·확대·다크·전체 + 진행률 (탭 토글) */}
      {dims?.isMobile && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-7 transition-opacity duration-200 ${
            overlayVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="mb-2.5 flex items-center justify-around text-white/80">
            {hasToc && (
              <button
                onClick={() => setTocOpen(true)}
                className="flex flex-col items-center gap-1 text-[10px]"
              >
                <span className="text-lg leading-none">☰</span>목차
              </button>
            )}
            {canZoom && (
              <button
                onClick={() => setZoomOpen(true)}
                className="flex flex-col items-center gap-1 text-[10px]"
              >
                <span className="text-lg leading-none">⊕</span>확대
              </button>
            )}
            <button
              onClick={() => setFlipEffect((v) => !v)}
              aria-pressed={flipEffect}
              className={`flex flex-col items-center gap-1 text-[10px] ${
                flipEffect ? "text-gold" : ""
              }`}
            >
              <span className="text-lg leading-none">📖</span>넘김
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              className="flex flex-col items-center gap-1 text-[10px]"
            >
              <span className="text-lg leading-none">◐</span>다크
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex flex-col items-center gap-1 text-[10px]"
            >
              <span className="text-lg leading-none">⛶</span>전체
            </button>
          </div>
          <div className="h-[3px] overflow-hidden rounded bg-white/20">
            <div
              className="h-full bg-gold transition-all duration-300"
              style={{ width: `${total ? ((currentPage + 1) / total) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-1.5 text-center font-label text-[10px] tracking-wide text-white/55">
            {displayPage} / {total}
          </div>
        </div>
      )}

      {/* 데스크톱 통합 컨트롤 바 (rev.3): 목차·한/두 페이지·페이지이동·확대·풀스크린·다크 */}
      {!dims?.isMobile && (
        <div className="flex-shrink-0 border-t border-white/10">
          <div className="flex items-center px-5 py-3">
            {/* 좌: 목차 + 한/두 페이지 토글 */}
            <div className="flex items-center gap-3">
              {hasToc && (
                <button
                  onClick={() => setTocOpen((v) => !v)}
                  aria-pressed={tocOpen}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-label text-xs uppercase tracking-wider transition-colors ${
                    tocOpen
                      ? "border-gold/40 bg-gold/15 text-gold"
                      : "border-white/15 text-white/60 hover:text-white"
                  }`}
                >
                  ☰ 목차
                </button>
              )}
              <div className="inline-flex items-center gap-0.5 rounded-full border border-white/15 p-0.5">
                <button
                  onClick={() => setForceSingle(true)}
                  aria-pressed={isSingle}
                  className={`rounded-full px-3 py-1 font-label text-xs uppercase tracking-wider transition-colors ${
                    isSingle ? "bg-gold text-ink" : "text-white/55 hover:text-white"
                  }`}
                >
                  한 페이지
                </button>
                <button
                  onClick={() => setForceSingle(false)}
                  aria-pressed={!isSingle}
                  className={`rounded-full px-3 py-1 font-label text-xs uppercase tracking-wider transition-colors ${
                    !isSingle ? "bg-gold text-ink" : "text-white/55 hover:text-white"
                  }`}
                >
                  두 페이지
                </button>
              </div>
            </div>

            {/* 중앙: 페이지 이동 */}
            <div className="flex flex-1 items-center justify-center gap-3">
              <button
                onClick={flipPrev}
                disabled={!(canPrev && !mobilePrevFlip && !isZoomed)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-gold disabled:opacity-30"
                aria-label="이전 페이지"
              >
                ‹
              </button>
              <span className="min-w-[92px] text-center font-label text-sm tracking-wide text-white/50">
                {displayPage} / {total}
              </span>
              <button
                onClick={flipNext}
                disabled={!(canNext && !mobilePrevFlip && !isZoomed)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-lg text-white/70 transition-colors hover:bg-white/10 hover:text-gold disabled:opacity-30"
                aria-label="다음 페이지"
              >
                ›
              </button>
            </div>

            {/* 우: 넘김 효과 · 줌 슬라이더 · 풀스크린 · 다크 */}
            <div className="flex items-center gap-2">
              {/* 넘김 효과 토글(#6) */}
              <button
                onClick={() => setFlipEffect((v) => !v)}
                aria-pressed={flipEffect}
                title="페이지 넘김 효과"
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-label text-[11px] uppercase tracking-wider transition-colors ${
                  flipEffect
                    ? "border-gold/40 bg-gold/15 text-gold"
                    : "border-white/15 text-white/45 hover:text-white"
                }`}
              >
                📖 넘김
              </button>
              {/* 줌 슬라이더(#5) — 휠/더블클릭/드래그도 동작 */}
              {canZoom && (
                <div className="flex items-center gap-1.5">
                  <span className="font-label text-[10px] text-white/40">🔍</span>
                  <input
                    type="range"
                    min={100}
                    max={300}
                    value={Math.round(deskScale * 100)}
                    onChange={(e) => setDeskZoom(Number(e.target.value) / 100)}
                    className="w-24 accent-gold"
                    aria-label="확대"
                  />
                  <span className="w-9 text-right font-label text-[10px] text-white/50">
                    {Math.round(deskScale * 100)}%
                  </span>
                </div>
              )}
              <button
                onClick={toggleFullscreen}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="전체화면"
                aria-label="전체화면"
              >
                ⛶
              </button>
              <button
                onClick={() => setDark((d) => !d)}
                aria-pressed={!dark}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="배경 밝기"
                aria-label="배경 밝기"
              >
                ◐
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomOpen && canZoom && (
        <MagazineZoomLightbox onClose={() => setZoomOpen(false)}>
          {currentPageObj.kind === "composed" ? (
            <div className="h-full w-full">
              <ComposedPage layout={parsePageLayout(currentPageObj.layout)} />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentPageObj.imageUrl ?? ""}
              alt={`Page ${currentPage + 1}`}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </MagazineZoomLightbox>
      )}
    </div>
  );
}

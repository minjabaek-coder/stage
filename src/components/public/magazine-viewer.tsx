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
    onSingleTap?: () => void;
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
            // Not zoomed → single tap callback (e.g. toggle TOC)
            callbacksRef.current?.onSingleTap?.();
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
  { page: MagazinePage; isMobile?: boolean; style?: CSSProperties }
>(function FlipPage({ page, isMobile, style }, ref) {
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
      {!isMobile && (
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          {page.pageNumber}
        </span>
      )}
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
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[99] bg-black/40"
          onClick={onClose}
        />
        {/* Bottom carousel modal */}
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-ink/95 backdrop-blur-sm">
          <div
            className="toc-carousel flex gap-3 overflow-x-auto px-4 py-3"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            <style>{`.toc-carousel::-webkit-scrollbar { display: none }`}</style>
            {tocEntries.map((entry) => {
              const page = pages.find((p) => p.pageNumber === entry.pageNumber);
              if (!page) return null;
              const isActive = currentPage + 1 === entry.pageNumber;
              return (
                <button
                  key={entry.id}
                  ref={isActive ? activeCardRef : undefined}
                  onClick={() => {
                    onNavigate(entry.pageNumber);
                    onClose();
                  }}
                  className={`flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                    isActive
                      ? "ring-2 ring-gold shadow-lg shadow-gold/10"
                      : "ring-1 ring-white/15 opacity-70"
                  }`}
                  style={{ width: 100 }}
                >
                  <div className="relative h-32 w-full bg-ink-deep">
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
                  <div className="px-2 py-1.5 bg-ink/80">
                    <span className="block truncate text-[11px] text-white/80">
                      {entry.title}
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
      onSingleTap: hasToc ? () => setTocOpen((v) => !v) : undefined,
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
    },
    [resetZoom]
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
      // Mobile: use custom CSS 3D flip overlay (left→right)
      setMobilePrevFlip({
        prevPage: pages[currentPage - 1],
        currentPage: pages[currentPage],
      });
    } else {
      // Desktop: use react-pageflip
      const pf = bookRef.current?.pageFlip();
      if (pf) pf.flipPrev("top");
    }
  }, [currentPage, dims?.isMobile, pages]);

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
    <div ref={rootRef} className="flex h-full flex-col bg-ink-deep">
      {/* 리더 헤더 (rev.3): STAGE · Issue · 제목 · ✕ 닫기 + 진행률 밑줄 */}
      <header className="relative flex-shrink-0">
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
          className={`flex flex-1 justify-center overflow-hidden ${dims?.isMobile ? "items-start" : "items-center"}`}
          style={{ background: dark ? undefined : "#f6f3f2" }}
        >
        {!ready && <div className="font-label text-sm tracking-wide text-white/40">Loading…</div>}
        {ready && (
          <div
            ref={zoomContainerRef}
            onDoubleClick={
              !dims.isMobile && canZoom ? () => setZoomOpen(true) : undefined
            }
            style={{
              width: dims.single ? dims.pageW : dims.wrapW,
              height: dims.wrapH,
              touchAction: dims.isMobile ? "none" : "auto",
              cursor: !dims.isMobile && canZoom ? "zoom-in" : undefined,
            }}
            className="relative flex-shrink-0"
          >
            <div
              style={{
                transform: dims.isMobile && zoomScale > 1
                  ? `translate(${zoomTranslate.x}px, ${zoomTranslate.y}px) scale(${zoomScale})`
                  : undefined,
                transformOrigin: "center center",
                width: "100%",
                height: "100%",
                transition: zoomScale === 1 ? "transform 0.2s ease-out" : undefined,
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
              key={dims.single ? "single" : "spread"}
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
              flippingTime={dims.isMobile ? 600 : 800}
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
                <FlipPage key={page.id} page={page} isMobile={dims.isMobile} />
              ))}
            </HTMLFlipBook>
            </div>

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

        {/* 모바일: 확대 버튼(데스크톱은 하단 바로 이동) */}
        {canZoom && dims?.isMobile && (
          <button
            onClick={() => setZoomOpen(true)}
            className="absolute right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-ink/70 text-base text-white backdrop-blur-sm transition-colors hover:bg-ink hover:text-gold"
            title="확대"
            aria-label="페이지 확대"
          >
            🔍
          </button>
        )}

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

            {/* 우: 확대 · 풀스크린 · 다크 */}
            <div className="flex items-center gap-1.5">
              {canZoom && (
                <button
                  onClick={() => setZoomOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 font-label text-xs uppercase tracking-wider text-white/60 transition-colors hover:text-white"
                  title="확대 (페이지 더블클릭)"
                >
                  🔍 확대
                </button>
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

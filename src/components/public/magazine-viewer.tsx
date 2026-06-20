"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  type CSSProperties,
} from "react";
// Using native <img> to avoid Vercel Image Optimization limits
import type { MagazinePage, MagazineTocEntry } from "@/types/magazine";
import { ComposedPage } from "./composed-page";
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
      className="relative h-full w-full overflow-hidden bg-neutral-900"
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

// ── Controls ──
function Controls({
  onPrev,
  onNext,
  canPrev,
  canNext,
  label,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 text-lg text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-30"
      >
        &larr;
      </button>
      <span className="min-w-[100px] text-center text-sm text-gray-500">
        {label}
      </span>
      <button
        onClick={onNext}
        disabled={!canNext}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 text-lg text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-30"
      >
        &rarr;
      </button>
    </div>
  );
}

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
      <div className="absolute inset-0 overflow-hidden bg-neutral-900">
        <PageBody
          page={currentPage}
          imgClassName="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      {/* Previous page flipping in from the left */}
      <div
        className="absolute inset-0 overflow-hidden bg-neutral-900"
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

// ── TOC Thumbnail Strip ──
export function TocThumbnailStrip({
  tocEntries,
  pages,
  currentPage,
  onNavigate,
}: {
  tocEntries: MagazineTocEntry[];
  pages: MagazinePage[];
  currentPage: number;
  onNavigate: (pageNumber: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [currentPage]);

  return (
    <div
      ref={scrollRef}
      className="toc-thumb-strip flex gap-2 overflow-x-auto px-3 py-2"
      style={{
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
    >
      <style>{`.toc-thumb-strip::-webkit-scrollbar { display: none }`}</style>
      {tocEntries.map((entry) => {
        const page = pages.find((p) => p.pageNumber === entry.pageNumber);
        if (!page) return null;
        const isActive = currentPage + 1 === entry.pageNumber;
        return (
          <button
            key={entry.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => onNavigate(entry.pageNumber)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-md p-1 transition-colors ${
              isActive ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <div
              className={`relative h-20 w-16 overflow-hidden rounded ${
                isActive ? "ring-2 ring-white" : "ring-1 ring-white/20"
              }`}
            >
              {page.kind === "composed" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
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
            <span className="max-w-16 truncate text-[10px] text-gray-400">
              {entry.title}
            </span>
          </button>
        );
      })}
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
        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-gray-900/95 backdrop-blur-sm">
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
                      ? "ring-2 ring-white shadow-lg shadow-white/10"
                      : "ring-1 ring-white/15 opacity-70"
                  }`}
                  style={{ width: 100 }}
                >
                  <div className="relative h-32 w-full bg-neutral-800">
                    {page.kind === "composed" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
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
                  <div className="px-2 py-1.5 bg-gray-800/80">
                    <span className="block truncate text-[11px] text-gray-200">
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
    <div className="absolute right-0 top-0 bottom-0 z-50 flex w-72 flex-col border-l border-white/10 bg-gray-900/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold text-white">목차</span>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
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
                  ? "bg-white/15 text-white"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate">{entry.title}</span>
                <span className="text-xs text-gray-500">p.{entry.pageNumber}</span>
              </div>
              {page && (
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded">
                  {page.kind === "composed" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
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
  magazineId,
  tocEntries = [],
}: {
  pages: MagazinePage[];
  magazineId?: string;
  tocEntries?: MagazineTocEntry[];
}) {
  const HTMLFlipBook = useFlipBook();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);
  const [dims, setDims] = useState<{
    pageW: number;
    pageH: number;
    wrapW: number;
    wrapH: number;
    isMobile: boolean;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isPortrait, setIsPortrait] = useState(false);
  const pageRatioRef = useRef(3 / 4);

  // Pinch-to-zoom (mobile)
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const ready = HTMLFlipBook && dims;
  const [tocOpen, setTocOpen] = useState(false);
  const hasToc = tocEntries.length > 0;

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

      if (isMobile) {
        // Always fill full width, height follows aspect ratio
        const pageW = Math.floor(cw);
        const pageH = Math.floor(cw / PAGE_RATIO);
        setDims({ pageW, pageH, wrapW: pageW, wrapH: pageH, isMobile: true });
      } else {
        const bookWIfH = 2 * ch * PAGE_RATIO;
        let pageW: number, pageH: number;
        if (bookWIfH <= cw) {
          pageH = Math.floor(ch);
          pageW = Math.floor(ch * PAGE_RATIO);
        } else {
          pageW = Math.floor(cw / 2);
          pageH = Math.floor(pageW / PAGE_RATIO);
        }
        setDims({ pageW, pageH, wrapW: pageW * 2, wrapH: pageH, isMobile: false });
      }
    }

    if (pages.length > 0) {
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
      img.src = pages[0].imageUrl ?? "";
    } else {
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
  }, [pages]);

  const viewTrackedRef = useRef(false);

  const onFlip = useCallback(
    (e: { data: number }) => {
      setCurrentPage(e.data);
      resetZoom();

      if (!viewTrackedRef.current && magazineId) {
        const key = `viewed:magazine:${magazineId}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          fetch("/api/views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "magazine", id: magazineId }),
          });
        }
        viewTrackedRef.current = true;
      }
    },
    [magazineId, resetZoom]
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
  const isSingle = isPortrait || (dims?.isMobile ?? false);
  const displayPage = isSingle
    ? `${currentPage + 1}`
    : `${currentPage + 1}-${Math.min(currentPage + 2, total)}`;
  const canPrev = currentPage > 0;
  const canNext = isSingle
    ? currentPage + 1 < total
    : currentPage + 2 < total;

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className={`flex flex-1 justify-center overflow-hidden ${dims?.isMobile ? "items-start" : "items-center"}`}
        >
        {!ready && <div className="text-gray-500">Loading...</div>}
        {ready && (
          <div
            ref={zoomContainerRef}
            style={{
              width: dims.isMobile ? dims.pageW : dims.wrapW,
              height: dims.wrapH,
              touchAction: dims.isMobile ? "none" : "auto",
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
              usePortrait={dims.isMobile}
              startPage={0}
              startZIndex={0}
              autoSize={false}
              mobileScrollSupport={true}
              clickEventForward={false}
              useMouseEvents={true}
              swipeDistance={dims.isMobile ? 9999 : 30}
              showPageCorners={!dims.isMobile}
              disableFlipByClick={dims.isMobile}
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

        {hasToc && (
          <>
            {/* Desktop: ☰ button */}
            {!dims?.isMobile && !tocOpen && (
              <button
                onClick={() => setTocOpen(true)}
                className="absolute right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-lg text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                title="목차"
              >
                ☰
              </button>
            )}
            {/* Mobile: tap triggers carousel modal; Desktop: side panel */}
            <TocPanel
              tocEntries={tocEntries}
              pages={pages}
              currentPage={currentPage}
              isOpen={tocOpen}
              onClose={() => setTocOpen(false)}
              onNavigate={navigateToPage}
              isMobile={dims?.isMobile ?? false}
            />
          </>
        )}
      </div>
      {!dims?.isMobile && hasToc && (
        <TocThumbnailStrip
          tocEntries={tocEntries}
          pages={pages}
          currentPage={currentPage}
          onNavigate={navigateToPage}
        />
      )}
      {!dims?.isMobile && (
        <Controls
          onPrev={flipPrev}
          onNext={flipNext}
          canPrev={canPrev && !mobilePrevFlip && !isZoomed}
          canNext={canNext && !mobilePrevFlip && !isZoomed}
          label={`${displayPage} / ${total}`}
        />
      )}
    </div>
  );
}

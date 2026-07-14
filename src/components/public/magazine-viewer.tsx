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

// ── TOC 필름스트립 (rev.4) — 하단 가로 밴드(데스크톱·모바일 공통).
// 오버레이가 아니라 레이아웃 밴드: 열리면 페이지 영역이 줄어 페이지가 가려지지 않음.
// 항목 = 썸네일 + 쪽번호(제목 생략, 가독성). 현재 페이지 골드 하이라이트·자동 센터.
export function TocFilmstrip({
  entries,
  pages,
  currentPage,
  onNavigate,
  onClose,
  overlay = false,
}: {
  entries: { pageNumber: number; title: string | null }[]; // 편집자 TocEntry 또는 전체 페이지 폴백
  pages: MagazinePage[];
  currentPage: number; // 0-based
  onNavigate: (pageNumber: number) => void; // 1-based
  onClose: () => void;
  overlay?: boolean; // 모바일: 페이지 위 오버레이(고투명) / 데스크톱: in-flow 밴드(약투명)
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentPage]);

  return (
    // overlay(모바일): 배경은 상위 컨테이너가 제공(투명) → 컨트롤과 동일 패널.
    // 데스크톱(in-flow): 고투명 패널(bg-ink/45) + 블러.
    <div
      className={`flex-none ${
        overlay ? "" : "border-t border-white/10 bg-ink/45 backdrop-blur-md"
      }`}
    >
      <div className="flex items-center justify-between px-3 pt-1.5">
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
          목차
        </span>
        <button
          onClick={onClose}
          aria-label="목차 닫기"
          className="flex h-6 w-6 items-center justify-center rounded text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
        {entries.map((entry, i) => {
          const page = pages.find((p) => p.pageNumber === entry.pageNumber);
          const isActive = currentPage + 1 === entry.pageNumber;
          return (
            <button
              key={`${entry.pageNumber}-${i}`}
              ref={isActive ? activeRef : undefined}
              onClick={() => onNavigate(entry.pageNumber)}
              aria-current={isActive}
              title={entry.title ?? undefined}
              className="group flex-none"
            >
              <div
                className={`relative aspect-[2/3] w-12 overflow-hidden rounded bg-ink-deep transition ${
                  isActive
                    ? "ring-2 ring-gold ring-offset-2 ring-offset-ink"
                    : "opacity-70 group-hover:opacity-100"
                }`}
              >
                {page &&
                  (page.kind === "composed" ? (
                    <ComposedPage layout={parsePageLayout(page.layout)} fit="cover" />
                  ) : page.imageUrl ? (
                    <img
                      src={page.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null)}
              </div>
              <span
                className={`mt-1 block text-center font-label text-[9px] ${
                  isActive ? "text-gold" : "text-white/45"
                }`}
              >
                {entry.pageNumber}
              </span>
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
  const fsAttempted = useRef(false); // 모바일 자동 전체화면 1회 시도(F5)
  const scrubRef = useRef<HTMLDivElement>(null); // 모바일 하단 진행률 스크러버(F6)
  const lastScrubIdx = useRef(-1);
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
  // rev.4 목차 필름스트립: 편집자 TocEntry가 있으면 그걸, 없으면 전체 페이지로 폴백(내비게이터).
  const tocItems =
    tocEntries.length > 0
      ? tocEntries.map((e) => ({ pageNumber: e.pageNumber, title: e.title }))
      : pages.map((p) => ({ pageNumber: p.pageNumber, title: null as string | null }));
  const hasToc = tocItems.length > 1;
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

  // F6: 하단 진행률 스크러버 — 트랙 좌표 → 페이지 시크(인덱스 변할 때만 이동)
  const scrubTo = useCallback(
    (clientX: number) => {
      const el = scrubRef.current;
      const tot = pages.length;
      if (!el || tot <= 1) return;
      const r = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const idx = Math.round(ratio * (tot - 1));
      if (idx !== lastScrubIdx.current) {
        lastScrubIdx.current = idx;
        navigateToPage(idx + 1);
      }
    },
    [pages.length, navigateToPage]
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
    // 컨테이너 자체 크기 변화(목차 필름스트립 토글 등)에도 재측정 — 페이지 리플로우
    const ro = new ResizeObserver(() => computeDims());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      ro.disconnect();
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
      // rev.4 F4: 모바일은 항상 즉시 전환(넘김 효과 없음)
      bookRef.current?.pageFlip()?.turnToPage(currentPage - 1);
    } else if (dims?.single) {
      // 데스크톱 단면(portrait): react-pageflip 역넘김이 불안정(무반응) →
      // turnToPage로 확실히 이전 페이지 이동(단면 역넘김 어색함도 함께 해소)
      bookRef.current?.pageFlip()?.turnToPage(currentPage - 1);
    } else {
      // 데스크톱 양면(스프레드): react-pageflip 역넘김
      const pf = bookRef.current?.pageFlip();
      if (pf) pf.flipPrev("top");
    }
  }, [currentPage, dims?.isMobile, dims?.single]);

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

  // rev.4 F5: 모바일 진입 시 전체화면 1회 시도(제스처 제약·미지원 시 조용히 폴백)
  useEffect(() => {
    if (!dims?.isMobile || fsAttempted.current) return;
    fsAttempted.current = true;
    const el = rootRef.current;
    if (el && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
  }, [dims?.isMobile]);

  const total = pages.length;
  const isSingle = dims?.single ?? isPortrait;
  // rev.4 F4: 넘김 효과는 데스크톱에서만(모바일은 항상 즉시 전환)
  const flipOn = !dims?.isMobile && flipEffect;
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

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
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
              key={`${dims.single ? "single" : "spread"}-${flipOn ? "flip" : "instant"}`}
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
              flippingTime={flipOn ? 800 : 1}
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
        {/* 데스크톱: 목차 = 페이지 위 반투명 오버레이(뒤 페이지가 비쳐 보임, 모바일과 동일 톤) */}
        {!dims?.isMobile && hasToc && tocOpen && (
          <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/45 backdrop-blur-md">
            <TocFilmstrip
              overlay
              entries={tocItems}
              pages={pages}
              currentPage={currentPage}
              onNavigate={navigateToPage}
              onClose={() => setTocOpen(false)}
            />
          </div>
        )}
      </div>

      {/* 모바일: 하단 레이어 = 페이지 위 오버레이(고투명). 목차+컨트롤이 하나의 반투명 패널로 통일. */}
      {dims?.isMobile && (tocOpen || overlayVisible) && (
        <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-xl border-t border-white/10 bg-ink/45 backdrop-blur-md">
          {hasToc && tocOpen && (
            <TocFilmstrip
              overlay
              entries={tocItems}
              pages={pages}
              currentPage={currentPage}
              onNavigate={navigateToPage}
              onClose={() => setTocOpen(false)}
            />
          )}
          {overlayVisible && (
            <div
              className={`px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 ${
                hasToc && tocOpen ? "border-t border-white/10" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-around text-white/85">
                {/* rev.4: 모바일 컨트롤 = 목차·다크·전체 (확대·넘김 제거) */}
                {hasToc && (
                  <button
                    onClick={() => setTocOpen((v) => !v)}
                    aria-pressed={tocOpen}
                    className={`flex flex-col items-center gap-1 text-[10px] ${tocOpen ? "text-gold" : ""}`}
                  >
                    <span className="text-lg leading-none">☰</span>목차
                  </button>
                )}
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
              {/* F6: 드래그 스크러버 — 바를 드래그/탭하면 해당 페이지로 이동 */}
              <div
                ref={scrubRef}
                role="slider"
                aria-label="페이지 이동"
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={currentPage + 1}
                className="relative flex h-6 cursor-pointer touch-none select-none items-center"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  lastScrubIdx.current = -1;
                  scrubTo(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX);
                }}
                onPointerUp={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }}
              >
                <div className="h-[3px] w-full overflow-hidden rounded bg-white/20">
                  <div
                    className="h-full bg-gold"
                    style={{ width: `${total > 1 ? (currentPage / (total - 1)) * 100 : 0}%` }}
                  />
                </div>
                <span
                  className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold bg-white shadow"
                  style={{ left: `${total > 1 ? (currentPage / (total - 1)) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-1 text-center font-label text-[10px] tracking-wide text-white/55">
                {displayPage} / {total}
              </div>
            </div>
          )}
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

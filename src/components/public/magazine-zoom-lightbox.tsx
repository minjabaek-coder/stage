"use client";

import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";

// 매거진 지면 확대 라이트박스.
// - 넘기기/페이지 뷰어 공통: 현재 페이지(이미지형 <img> 또는 구성형 ComposedPage)를
//   전체화면 오버레이로 띄워 자유 줌·팬. children으로 임의 콘텐츠를 받는다.
// - 데스크탑: 휠 줌(커서 기준) + 드래그 팬 + 더블클릭 토글 + +/− 버튼 + Esc.
// - 모바일: 핀치 줌 + 드래그 팬 + 더블탭 토글.
// react-pageflip 넘김 애니메이션과 완전히 분리돼 트랜스폼 충돌이 없음.
const MIN = 1;
const MAX = 5;
const DOUBLE = 2.5;

export function MagazineZoomLightbox({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0 });

  const apply = useCallback((s: number, x: number, y: number) => {
    stateRef.current = { scale: s, tx: x, ty: y };
    setScale(s);
    setTranslate({ x, y });
  }, []);

  const clamp = useCallback((x: number, y: number, s: number) => {
    const el = containerRef.current;
    if (!el || s <= 1) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const maxX = (r.width * (s - 1)) / 2;
    const maxY = (r.height * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  // 한 점(커서/핀치 중심)을 기준으로 줌 — 그 지점의 콘텐츠가 화면에 고정되도록 translate 보정.
  const zoomToPoint = useCallback(
    (nextScale: number, originX?: number, originY?: number) => {
      const el = containerRef.current;
      const cur = stateRef.current;
      const s = Math.max(MIN, Math.min(MAX, nextScale));
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = originX != null ? originX - cx : 0;
      const dy = originY != null ? originY - cy : 0;
      const ratio = s / cur.scale;
      const nx = dx - ratio * (dx - cur.tx);
      const ny = dy - ratio * (dy - cur.ty);
      const c = clamp(nx, ny, s);
      apply(s, c.x, c.y);
    },
    [apply, clamp]
  );

  const reset = useCallback(() => apply(1, 0, 0), [apply]);

  // 키보드: Esc 닫기, +/− 줌
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomToPoint(stateRef.current.scale * 1.3);
      else if (e.key === "-" || e.key === "_") zoomToPoint(stateRef.current.scale / 1.3);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomToPoint]);

  // 휠 줌(데스크탑) — 커서 기준
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomToPoint(stateRef.current.scale * factor, e.clientX, e.clientY);
    },
    [zoomToPoint]
  );

  // 마우스 드래그 팬(데스크탑, 줌 상태에서만)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (stateRef.current.scale <= 1) return;
    e.preventDefault();
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      tx: stateRef.current.tx,
      ty: stateRef.current.ty,
    };
  }, []);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const c = clamp(d.tx + (e.clientX - d.x), d.ty + (e.clientY - d.y), stateRef.current.scale);
      apply(stateRef.current.scale, c.x, c.y);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [apply, clamp]);

  // 더블클릭/더블탭 토글
  const toggleZoom = useCallback(
    (x?: number, y?: number) => {
      if (stateRef.current.scale > 1.05) reset();
      else zoomToPoint(DOUBLE, x, y);
    },
    [reset, zoomToPoint]
  );

  // 터치: 핀치 줌 + 한 손가락 팬 (모바일)
  const pinchRef = useRef<{ dist: number; scale: number; midX: number; midY: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const tapRef = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const lastTapRef = useRef(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (a: Touch, b: Touch) =>
      Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    function onStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchRef.current = {
          dist: dist(e.touches[0], e.touches[1]),
          scale: stateRef.current.scale,
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        panRef.current = null;
      } else if (e.touches.length === 1) {
        tapRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          t: performance.now(),
          moved: false,
        };
        if (stateRef.current.scale > 1) {
          panRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            tx: stateRef.current.tx,
            ty: stateRef.current.ty,
          };
        }
      }
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const next = pinchRef.current.scale * (d / pinchRef.current.dist);
        zoomToPoint(next, pinchRef.current.midX, pinchRef.current.midY);
      } else if (e.touches.length === 1) {
        if (tapRef.current) {
          const dx = e.touches[0].clientX - tapRef.current.x;
          const dy = e.touches[0].clientY - tapRef.current.y;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) tapRef.current.moved = true;
        }
        if (panRef.current && stateRef.current.scale > 1) {
          e.preventDefault();
          const p = panRef.current;
          const c = clamp(
            p.tx + (e.touches[0].clientX - p.x),
            p.ty + (e.touches[0].clientY - p.y),
            stateRef.current.scale
          );
          apply(stateRef.current.scale, c.x, c.y);
        }
      }
    }

    function onEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        pinchRef.current = null;
        panRef.current = null;
        // 탭 / 더블탭 판정
        const tap = tapRef.current;
        tapRef.current = null;
        if (tap && !tap.moved) {
          const now = performance.now();
          if (now - lastTapRef.current < 300) {
            // 더블탭 → 토글
            e.preventDefault();
            toggleZoom(tap.x, tap.y);
            lastTapRef.current = 0;
          } else {
            lastTapRef.current = now;
          }
        }
      }
    }

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [apply, clamp, zoomToPoint, toggleZoom]);

  const isZoomed = scale > 1.05;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm">
      {/* 상단 컨트롤 */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
        <span className="font-label text-xs tracking-wide text-white/50">
          {Math.round(scale * 100)}%
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => zoomToPoint(stateRef.current.scale / 1.3)}
            aria-label="축소"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-lg text-white/80 transition-colors hover:bg-white/10 hover:text-gold"
          >
            −
          </button>
          <button
            onClick={() => zoomToPoint(stateRef.current.scale * 1.3)}
            aria-label="확대"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-lg text-white/80 transition-colors hover:bg-white/10 hover:text-gold"
          >
            +
          </button>
          <button
            onClick={reset}
            disabled={!isZoomed}
            aria-label="원래 크기"
            className="ml-1 rounded-lg border border-white/15 px-3 font-label text-xs uppercase tracking-wider text-white/80 transition-colors hover:bg-white/10 hover:text-gold disabled:opacity-30"
            style={{ height: 36 }}
          >
            맞춤
          </button>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-lg text-white/80 transition-colors hover:bg-white/10 hover:text-gold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 줌 캔버스 */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onDoubleClick={(e) => toggleZoom(e.clientX, e.clientY)}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{
          touchAction: "none",
          cursor: isZoomed ? "grab" : "zoom-in",
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: scale === 1 ? "transform 0.2s ease-out" : "none",
          }}
        >
          {children}
        </div>
      </div>

      <p className="flex-shrink-0 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 text-center text-[11px] text-white/35">
        스크롤·핀치로 확대 · 드래그로 이동 · 더블클릭/탭 · Esc 닫기
      </p>
    </div>
  );
}

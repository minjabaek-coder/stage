"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

// 초점(focal point) + 줌 피커 — 채우기(크롭) 시 이미지의 어느 지점을 남길지 지정.
// 비파괴: 원본은 그대로 두고 objectPosition/scale로 렌더 시 크롭한다.
// 구성형 페이지 이미지(page-editor)와 기사 썸네일(article-form)이 공유.
export function FocusPicker({
  src,
  focusX,
  focusY,
  zoom,
  onChange,
  onZoomChange,
}: {
  src: string;
  focusX: number;
  focusY: number;
  zoom: number;
  onChange: (x: number, y: number) => void;
  onZoomChange: (z: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.5); // w/h
  const dragging = useRef(false);

  function apply(e: ReactPointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    onChange(Math.round(x), Math.round(y));
  }

  return (
    <div className="space-y-1">
      <span className="block text-xs font-medium text-gray-600">
        초점(크롭 기준) — 클릭/드래그로 지정
      </span>
      <div
        ref={ref}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          apply(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current) apply(e);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        className="relative mx-auto w-full max-w-[220px] overflow-hidden rounded border bg-gray-100"
        style={{ aspectRatio: String(ratio), cursor: "crosshair", touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight)
              setRatio(img.naturalWidth / img.naturalHeight);
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          style={{
            position: "absolute",
            left: `${focusX}%`,
            top: `${focusY}%`,
            transform: "translate(-50%, -50%)",
            width: 18,
            height: 18,
            borderRadius: 9999,
            border: "2px solid #fff",
            boxShadow: "0 0 0 2px #1f6f72",
            background: "rgba(31,111,114,.35)",
            pointerEvents: "none",
          }}
        />
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs">
          X%
          <input
            type="number"
            min={0}
            max={100}
            value={focusX}
            onChange={(e) => onChange(Number(e.target.value), focusY)}
            className="mt-0.5 w-full rounded border px-1 py-0.5"
          />
        </label>
        <label className="flex-1 text-xs">
          Y%
          <input
            type="number"
            min={0}
            max={100}
            value={focusY}
            onChange={(e) => onChange(focusX, Number(e.target.value))}
            className="mt-0.5 w-full rounded border px-1 py-0.5"
          />
        </label>
      </div>
      <label className="block text-xs">
        <span className="flex items-center justify-between text-gray-600">
          <span>확대(줌)</span>
          <span className="tabular-nums">{zoom.toFixed(1)}×</span>
        </span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
    </div>
  );
}

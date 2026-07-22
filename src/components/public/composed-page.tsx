"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  type Block,
  type PageLayout,
  LAYOUT_BASE_WIDTH,
} from "@/types/magazine-layout";

// 설계 캔버스 크기(2:3). 모든 블록 좌표(%)·글자 px는 이 캔버스를 기준으로 한다.
const BASE_W = LAYOUT_BASE_WIDTH; // 440
const BASE_H = Math.round((BASE_W * 3) / 2); // 660

// 구성형(39호+) 페이지 렌더러.
// 고정 캔버스(BASE_W×BASE_H)에 그린 뒤 부모 영역에 맞춰 통째로 transform:scale —
// 글자·이미지가 함께 균일 비례(기존 이미지 뷰어처럼 "통으로 스케일되는 이미지"처럼 보임).
// 단, 텍스트는 실제 텍스트로 유지(검색·AI·복사). 에디터(D3)와 공유하는 표시 컴포넌트.
export function ComposedPage({
  layout,
  className,
  fit = "contain",
}: {
  layout: PageLayout | null;
  className?: string;
  // contain(기본·뷰어): 여백 맞춤 / cover(표지 썸네일): 박스를 꽉 채우고 넘침은 클립
  fit?: "contain" | "cover";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        const sx = w / BASE_W, sy = h / BASE_H;
        setScale(fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  if (!layout) return null;
  const blocks = [...layout.blocks].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
      // 뷰어에서 모서리 드래그-넘김(react-pageflip)이 텍스트 선택에 가로채이지
      // 않도록 — 이미지 페이지와 동일한 책장 넘김 인터랙션 유지.
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: BASE_W,
          height: BASE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          background: layout.pageBg ?? "#ffffff",
          overflow: "hidden",
          // 측정 전 깜빡임 방지
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        {blocks.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
              transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
              opacity: b.opacity ?? 1,
              zIndex: b.z,
              overflow: "hidden",
            }}
          >
            <ComposedBlockBody block={b} />
          </div>
        ))}
      </div>
    </div>
  );
}

// 블록 내용 렌더러 — 뷰어와 에디터(D3b)가 공유해 WYSIWYG 유지.
export function ComposedBlockBody({ block }: { block: Block }) {
  if (block.type === "image") {
    const fit = block.fit ?? "cover";
    const focusX = block.focusX ?? 50;
    const focusY = block.focusY ?? 50;
    // 채우기(cover)에서만 초점 기준 확대(줌). 초점 지점을 고정한 채 더 당겨 본다.
    const zoom = fit === "cover" ? Math.max(1, block.zoom ?? 1) : 1;
    // 빈 이미지 블록(src 없음)은 렌더하지 않음 — <img src=""> 경고/재요청 방지
    if (!block.src) return null;
    return (
      <>
        <img
          src={block.src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: `${focusX}% ${focusY}%`,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: `${focusX}% ${focusY}%`,
            borderRadius: block.radius ? `${block.radius}px` : undefined,
          }}
        />
        {block.overlayDarken ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(0,0,0,${block.overlayDarken / 100})`,
            }}
          />
        ) : null}
      </>
    );
  }

  if (block.type === "shape") {
    if (block.shape === "line") {
      const col = block.stroke || block.fill || "#1c1b1b";
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
          <line x1="0" y1="50" x2="100" y2="50" stroke={col} strokeWidth={block.strokeWidth ?? 2} vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }
    if (block.shape === "triangle" || block.shape === "diamond") {
      const points =
        block.shape === "triangle" ? "50,2 98,98 2,98" : "50,2 98,50 50,98 2,50";
      return (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
          <polygon
            points={points}
            fill={block.fill ?? "#1f6f72"}
            stroke={block.stroke}
            strokeWidth={block.stroke ? block.strokeWidth ?? 1 : undefined}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );
    }
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: block.fill ?? "#1f6f72",
          borderRadius: block.shape === "ellipse" ? "50%" : block.radius ? `${block.radius}px` : undefined,
          border: block.stroke && block.strokeWidth ? `${block.strokeWidth}px solid ${block.stroke}` : undefined,
        }}
      />
    );
  }

  // text — 글자 크기는 캔버스 기준 px (캔버스가 통째로 scale되므로 이미지와 함께 비례)
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    color: block.color ?? "#1c1b1b",
    fontSize: block.fontSizePx ? `${block.fontSizePx}px` : undefined,
    textAlign: block.align ?? "left",
    fontWeight: block.weight,
    lineHeight: block.lineHeight,
    background: block.bgColor,
    padding: block.padding ? `${block.padding}px` : undefined,
    overflow: "hidden",
    // Enter 줄바꿈(\n)을 그대로 표시 + 단어 줄바꿈. (HTML 태그도 함께 동작)
    whiteSpace: "pre-wrap",
    // 한글 줄바꿈: keep-all이면 어절(공백) 경계에서만 끊고, 한 어절이 폭보다 길면 강제 분해.
    ...(block.wordBreak === "keep-all"
      ? { wordBreak: "keep-all" as const, overflowWrap: "anywhere" as const }
      : {}),
  };
  return (
    <div
      style={style}
      // 텍스트는 CMS 저장 시 정제(sanitize)된 HTML을 신뢰
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  );
}

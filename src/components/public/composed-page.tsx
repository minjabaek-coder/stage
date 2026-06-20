import type { CSSProperties } from "react";
import {
  type Block,
  type PageLayout,
  LAYOUT_BASE_WIDTH,
} from "@/types/magazine-layout";

// 구성형(39호+) 페이지 렌더러. 부모 영역 안에서 2:3로 contain되어 중앙 배치.
// 글자 크기는 container query(cqw)로 비례 환산 → 썸네일~전체화면 일관.
// 에디터(D3)와 뷰어가 공유하는 표시 컴포넌트.
export function ComposedPage({
  layout,
  className,
}: {
  layout: PageLayout | null;
  className?: string;
}) {
  if (!layout) return null;
  const blocks = [...layout.blocks].sort((a, b) => a.z - b.z);

  return (
    <div
      className={`relative mx-auto h-full overflow-hidden ${className ?? ""}`}
      style={{
        aspectRatio: "2 / 3",
        maxWidth: "100%",
        background: layout.pageBg ?? "#ffffff",
        containerType: "inline-size",
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
          <BlockBody block={b} />
        </div>
      ))}
    </div>
  );
}

function BlockBody({ block }: { block: Block }) {
  if (block.type === "image") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.src}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: block.fit ?? "cover",
            objectPosition: `${block.focusX ?? 50}% ${block.focusY ?? 50}%`,
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

  // text
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    color: block.color ?? "#1c1b1b",
    // px → cqw (기준 폭 440 기준 비례)
    fontSize: block.fontSizePx
      ? `${(block.fontSizePx / LAYOUT_BASE_WIDTH) * 100}cqw`
      : undefined,
    textAlign: block.align ?? "left",
    fontWeight: block.weight,
    lineHeight: block.lineHeight,
    background: block.bgColor,
    padding: block.padding ? `${block.padding}px` : undefined,
    overflow: "hidden",
  };
  return (
    <div
      style={style}
      // 텍스트는 CMS 저장 시 정제(sanitize)된 HTML을 신뢰
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  );
}

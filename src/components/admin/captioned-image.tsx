"use client";

import TiptapImage from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

// 이미지 아래 인라인 캡션 입력(사진 에세이 지원). 저장 HTML은 <img data-caption="…">
// 단순 형태라 편집 왕복이 안전하고, 공개 렌더에서 figure+figcaption으로 변환한다
// (src/app/articles/[slug]/page.tsx의 figureizeCaptions).
function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, caption } = node.attrs as {
    src: string;
    alt?: string;
    caption?: string;
  };
  return (
    <NodeViewWrapper
      as="figure"
      className={`article-figure my-4${selected ? " outline outline-2 outline-gold-deep/60" : ""}`}
      contentEditable={false}
    >
      <img src={src} alt={alt || ""} className="mx-auto block w-full" />
      <input
        type="text"
        value={caption || ""}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        placeholder="캡션 입력… (선택)"
        aria-label="이미지 캡션"
        className="mt-1.5 w-full border-0 bg-transparent text-center text-xs italic text-gray-500 outline-none placeholder:not-italic placeholder:text-gray-300"
        onKeyDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </NodeViewWrapper>
  );
}

// TiptapImage 확장: caption 속성(→ data-caption) + 인라인 캡션 NodeView.
export const CaptionedImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") || "",
        renderHTML: (attrs) =>
          attrs.caption ? { "data-caption": attrs.caption } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

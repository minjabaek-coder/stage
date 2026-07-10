"use client";

import { Node } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useRef } from "react";
import { toast } from "sonner";
import { uploadBlogImage } from "@/lib/upload-client";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants";

type GalleryImage = { src: string; caption?: string };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageGallery: {
      setImageGallery: (attrs: { images: GalleryImage[] }) => ReturnType;
    };
  }
}

// 한 행 이미지 그리드(갤러리). 저장은 빈 <div data-gallery='[…]'> 리프로 — 내부에 실제
// <img>가 없어 ProseMirror가 개별 이미지로 오분해하지 않음(왕복 안전). 공개 렌더에서
// data-gallery를 figure 그리드로 확장(src/app/articles/[slug]/page.tsx galleryizeCaptions).
function GalleryView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const images: GalleryImage[] = Array.isArray(node.attrs.images)
    ? node.attrs.images
    : [];
  const fileRef = useRef<HTMLInputElement>(null);

  function setCaption(i: number, caption: string) {
    updateAttributes({
      images: images.map((im, idx) => (idx === i ? { ...im, caption } : im)),
    });
  }
  function removeAt(i: number) {
    const next = images.filter((_, idx) => idx !== i);
    if (next.length === 0) deleteNode();
    else updateAttributes({ images: next });
  }
  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) =>
      ACCEPTED_IMAGE_TYPES.includes(f.type),
    );
    if (list.length === 0) return;
    const toastId = toast.loading("이미지 업로드 중…");
    try {
      const urls = await Promise.all(list.map((f) => uploadBlogImage(f)));
      updateAttributes({
        images: [...images, ...urls.map((src) => ({ src, caption: "" }))],
      });
      toast.success("추가되었습니다", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패", { id: toastId });
    }
  }

  return (
    <NodeViewWrapper
      as="div"
      className={`article-gallery-editor my-4 rounded border p-2${selected ? " outline outline-2 outline-gold-deep/60" : ""}`}
      contentEditable={false}
    >
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
          gap: 8,
          alignItems: "start",
        }}
      >
        {images.map((im, i) => (
          <figure key={i} className="group relative m-0">
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="이미지 삭제"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.src} alt={im.caption || ""} className="block w-full" />
            <input
              type="text"
              value={im.caption || ""}
              onChange={(e) => setCaption(i, e.target.value)}
              placeholder="캡션…"
              aria-label="이미지 캡션"
              className="mt-1 w-full border-0 bg-transparent text-center text-[11px] italic text-gray-500 outline-none placeholder:not-italic placeholder:text-gray-300"
              onKeyDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </figure>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded border px-2 py-1 hover:bg-gray-50"
        >
          ＋ 사진 추가
        </button>
        <span>{images.length}장 · 한 행에 나란히 표시</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
    </NodeViewWrapper>
  );
}

export const ImageGallery = Node.create({
  name: "imageGallery",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [] as GalleryImage[],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-gallery") || "[]");
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          "data-gallery": JSON.stringify(attrs.images ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.article-gallery", priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { class: "article-gallery", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryView);
  },

  addCommands() {
    return {
      setImageGallery:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

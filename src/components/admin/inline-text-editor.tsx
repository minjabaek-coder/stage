"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, type CSSProperties } from "react";
import type { TextBlock } from "@/types/magazine-layout";

// 캔버스 위 텍스트 블록 인라인 WYSIWYG(E2.3).
// 더블클릭으로 진입 → 블록 자리에서 바로 편집(보는 그대로). 서식 툴바는 속성 패널(activeEditor)에서 제어.
export function InlineTextEditor({
  block,
  onChange,
  onReady,
}: {
  block: TextBlock;
  onChange: (html: string) => void;
  onReady?: (editor: Editor | null) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: block.html || "",
    immediatelyRender: false,
    autofocus: "end",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // 속성 패널 툴바가 쓰도록 에디터 인스턴스를 상위로 전달
  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  // ComposedBlockBody의 텍스트 스타일을 동일 적용 → WYSIWYG 일치
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
    overflow: "auto",
  };

  return (
    <div
      style={style}
      // 드래그/선택해제로 새지 않도록 포인터 이벤트를 블록 안에서 가둠
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="[&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror_:is(p,h1,h2,h3,ul,ol,blockquote)]:m-0"
    >
      <EditorContent editor={editor} />
    </div>
  );
}

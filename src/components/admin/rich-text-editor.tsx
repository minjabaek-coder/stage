"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { CaptionedImage } from "@/components/admin/captioned-image";
import { ImageGallery } from "@/components/admin/image-gallery";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { uploadBlogImage as uploadImage } from "@/lib/upload-client";

function ToolbarButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white"
          : "bg-white text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

function ImageInsertDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // 1장이면 단일 이미지, 2장 이상이면 한 행 그리드로 삽입(상위에서 분기).
  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)));
      onInsert(urls);
      setUrlInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    }
    setUploading(false);
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => handleFiles(files),
    onDropRejected: (rejections) => {
      const tooLarge = rejections[0]?.errors.some(
        (e) => e.code === "file-too-large"
      );
      toast.error(
        tooLarge
          ? "파일이 너무 큽니다 (최대 20MB)"
          : "지원하지 않는 파일 형식입니다"
      );
    },
    accept: Object.fromEntries(ACCEPTED_IMAGE_TYPES.map((t) => [t, []])),
    maxSize: MAX_FILE_SIZE,
    disabled: uploading,
    noClick: true, // 영역 클릭 대신 명시적 '파일 선택' 버튼으로만 열기
  });

  function handleUrlSubmit() {
    if (urlInput.trim()) {
      onInsert([urlInput.trim()]);
      setUrlInput("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>이미지 삽입</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              파일 업로드
            </Label>
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragActive
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-300 hover:border-gray-400"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <p className="text-sm text-gray-500">업로드 중...</p>
              ) : (
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md border bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50">
                    📁 파일 선택
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        if (e.target.files?.length) handleFiles(Array.from(e.target.files));
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <p className="text-xs text-gray-400">
                    또는 여기로 드래그 · JPG, PNG, WebP
                  </p>
                  <p className="text-[11px] text-gray-400">
                    여러 장 선택하면 한 행 그리드로 삽입됩니다
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">또는</span>
            </div>
          </div>

          {/* URL input */}
          <div>
            <Label htmlFor="image-url" className="mb-2 block text-sm font-medium">
              URL 직접 입력
            </Label>
            <div className="flex gap-2">
              <Input
                id="image-url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />
              <Button
                type="button"
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                size="sm"
              >
                삽입
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RichTextEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      // StarterKit(v3)이 Link를 포함 → 별도 extension-link 추가 시 'link' 중복 경고.
      // StarterKit의 link를 직접 설정.
      StarterKit.configure({ link: { openOnClick: false } }),
      CaptionedImage,
      ImageGallery,
      Placeholder.configure({ placeholder: "기사 본문을 입력하세요…" }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      handleDrop: (_view, event, _slice, moved) => {
        if (moved || !event.dataTransfer?.files.length) return false;
        const file = event.dataTransfer.files[0];
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return false;
        event.preventDefault();
        const toastId = toast.loading("이미지 업로드 중...");
        uploadImage(file)
          .then((url) => {
            editor?.chain().focus().setImage({ src: url }).run();
            toast.success("이미지가 삽입되었습니다", { id: toastId });
          })
          .catch((e) => {
            toast.error(e instanceof Error ? e.message : "업로드 실패", {
              id: toastId,
            });
          });
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        const imageFile = files.find((f) =>
          ACCEPTED_IMAGE_TYPES.includes(f.type)
        );
        if (!imageFile) return false;
        event.preventDefault();
        const toastId = toast.loading("이미지 업로드 중...");
        uploadImage(imageFile)
          .then((url) => {
            editor?.chain().focus().setImage({ src: url }).run();
            toast.success("이미지가 삽입되었습니다", { id: toastId });
          })
          .catch((e) => {
            toast.error(e instanceof Error ? e.message : "업로드 실패", {
              id: toastId,
            });
          });
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL을 입력하세요");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const handleImageInsert = useCallback(
    (urls: string[]) => {
      if (editor && urls.length > 0) {
        if (urls.length === 1) {
          editor.chain().focus().setImage({ src: urls[0] }).run();
        } else {
          // 여러 장 → 한 행 그리드
          editor
            .chain()
            .focus()
            .setImageGallery({
              images: urls.map((src) => ({ src, caption: "" })),
            })
            .run();
        }
      }
      setImageDialogOpen(false);
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <>
      <div className="rounded-lg border">
        <div className="sticky top-0 z-20 flex flex-wrap gap-1 rounded-t-lg border-b bg-gray-50/95 p-2 backdrop-blur">

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            I
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
          >
            List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            Quote
          </ToolbarButton>
          <ToolbarButton onClick={addLink} active={editor.isActive("link")}>
            Link
          </ToolbarButton>
          <ToolbarButton onClick={() => setImageDialogOpen(true)}>
            Image
          </ToolbarButton>
        </div>
        <EditorContent
          editor={editor}
          className="prose max-w-none p-4 [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
        />
      </div>

      <ImageInsertDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onInsert={handleImageInsert}
      />
    </>
  );
}

"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { uploadBlogImage } from "@/lib/upload-client";
import { contributeAction } from "@/actions/article-token-actions";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";

type State = { error?: string; success?: boolean; submitted?: boolean; status?: string } | undefined;

// 기고자 무계정 에디터 — 원고 필드(제목·본문·요약·썸네일·태그)만. slug·발행·바이라인 등은 관리자 전용.
export function ContributeEditor({
  token,
  initial,
}: {
  token: string;
  initial: {
    title: string;
    subtitle: string | null;
    excerpt: string | null;
    content: string;
    thumbnailUrl: string | null;
    tags: string[];
    status: string;
  };
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    contributeAction,
    undefined,
  );
  const [content, setContent] = useState(initial.content);
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl ?? "");
  const [uploading, setUploading] = useState(false);
  // 상태는 액션 결과에서 파생(서버가 반환). 저장 후에도 DB 실제 상태 반영.
  const status = state?.status ?? initial.status;

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success)
      toast.success(state.submitted ? "제출되었습니다" : "저장되었습니다");
  }, [state]);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      setThumbnailUrl(await uploadBlogImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다");
    }
    setUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: Object.fromEntries(ACCEPTED_IMAGE_TYPES.map((t) => [t, []])),
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    noClick: true, // 명시적 '파일 선택'·'변경' 버튼으로만 열기
  });

  const labelClass =
    "font-label text-[11px] uppercase tracking-wider text-gold-deep";
  const fieldClass =
    "mt-1 w-full border-b border-ink/20 bg-transparent py-2 text-sm text-ink focus:border-gold-deep focus:outline-none";

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />

      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider ${
            status === "submitted"
              ? "bg-teal text-white"
              : "bg-surface-warm text-taupe"
          }`}
        >
          {status === "submitted" ? "검토 대기" : "작성 중"}
        </span>
        <span className="text-xs text-taupe">
          제출 후에도 발행 전까지 계속 수정할 수 있습니다.
        </span>
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={initial.title}
          maxLength={200}
          className={`${fieldClass} font-headline text-lg`}
        />
      </div>

      <div>
        <label htmlFor="subtitle" className={labelClass}>부제 (소제목)</label>
        <input
          id="subtitle"
          name="subtitle"
          defaultValue={initial.subtitle ?? ""}
          maxLength={300}
          placeholder="제목 아래 표시되는 한 줄 (예: 그리스 섬 동부지중해 크루즈 여행기 ① 프롤로그)"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="excerpt" className={labelClass}>요약</label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={initial.excerpt ?? ""}
          placeholder="목록·검색에 쓰이는 짧은 요약"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="tags" className={labelClass}>태그</label>
        <input
          id="tags"
          name="tags"
          defaultValue={initial.tags.join(", ")}
          placeholder="태그1, 태그2 (콤마 구분)"
          className={fieldClass}
        />
      </div>

      <div className="space-y-2">
        <span className={labelClass}>썸네일</span>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed p-4 text-center transition-colors ${
            isDragActive ? "border-gold-deep bg-surface-warm" : "border-ink/20"
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <p className="text-sm text-taupe">업로드 중…</p>
          ) : thumbnailUrl ? (
            <div className="space-y-3">
              <div className="relative mx-auto aspect-video w-full max-w-xs overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailUrl} alt="썸네일" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={open}
                  className="border border-ink/20 px-3 py-1.5 font-label text-[11px] uppercase tracking-wider text-ink hover:border-gold-deep hover:text-gold-deep"
                >
                  이미지 변경
                </button>
                <button
                  type="button"
                  onClick={() => setThumbnailUrl("")}
                  className="border border-red-300 px-3 py-1.5 font-label text-[11px] uppercase tracking-wider text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <button
                type="button"
                onClick={open}
                className="border border-ink/30 px-4 py-2 font-label text-[11px] font-bold uppercase tracking-wider text-ink hover:border-gold-deep hover:text-gold-deep"
              >
                📁 파일 선택
              </button>
              <p className="text-xs text-taupe">또는 이미지를 여기로 드래그 · JPG/PNG/WebP</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className={labelClass}>본문</span>
        <RichTextEditor content={content} onChange={setContent} />
      </div>

      <div className="flex gap-3 border-t border-ink/10 pt-6">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending || uploading}
          className="border border-ink/20 px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-ink transition-colors hover:border-gold-deep hover:text-gold-deep disabled:opacity-50"
        >
          {pending ? "처리 중…" : "저장"}
        </button>
        <button
          type="submit"
          name="intent"
          value="submit"
          disabled={pending || uploading}
          className="bg-ink px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          제출하기
        </button>
      </div>
    </form>
  );
}

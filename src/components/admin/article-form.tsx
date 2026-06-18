"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "./rich-text-editor";
import { toast } from "sonner";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { uploadBlogImage } from "@/lib/upload-client";

type FormState = { error?: string; success?: boolean } | undefined;

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[가-힣]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || `article-${Date.now()}`;
}

export function ArticleForm({
  action,
  defaultValues,
  formId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    excerpt?: string | null;
    author?: string;
    category?: string;
    tags?: string[];
    content?: string;
    thumbnailUrl?: string | null;
    isFeatured?: boolean;
    isPremium?: boolean;
    aiIndexable?: boolean;
    publishedAt?: Date | null;
  };
  formId?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [content, setContent] = useState(defaultValues?.content || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    defaultValues?.thumbnailUrl || ""
  );
  const [slug, setSlug] = useState(defaultValues?.slug || "");
  const [title, setTitle] = useState(defaultValues?.title || "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success("저장되었습니다");
      router.push("/admin/articles");
    }
  }, [state, router]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadBlogImage(file);
      setThumbnailUrl(url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다"
      );
    }
    setUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => {
      const tooLarge = rejections[0]?.errors.some(
        (err) => err.code === "file-too-large"
      );
      toast.error(
        tooLarge ? "파일이 너무 큽니다 (최대 20MB)" : "지원하지 않는 파일 형식입니다"
      );
    },
    accept: Object.fromEntries(ACCEPTED_IMAGE_TYPES.map((type) => [type, []])),
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!defaultValues?.slug) setSlug(slugify(value));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>기사 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form id={formId} action={formAction} className="space-y-4">
            <input type="hidden" name="content" value={content} />
            <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />

            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">슬러그</Label>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-friendly-slug"
                required
              />
              <p className="text-xs text-gray-500">
                URL에 사용됩니다: /articles/{slug || "..."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">요약</Label>
              <textarea
                id="excerpt"
                name="excerpt"
                defaultValue={defaultValues?.excerpt || ""}
                rows={2}
                placeholder="목록·검색·OG에 쓰이는 짧은 요약"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="author">작성자</Label>
                <Input
                  id="author"
                  name="author"
                  defaultValue={defaultValues?.author}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">카테고리</Label>
                <Input
                  id="category"
                  name="category"
                  defaultValue={defaultValues?.category}
                  placeholder="예: 리뷰, 인터뷰, 칼럼"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publishedAt">작성날짜</Label>
              <Input
                id="publishedAt"
                name="publishedAt"
                type="date"
                defaultValue={
                  defaultValues?.publishedAt
                    ? new Date(defaultValues.publishedAt)
                        .toISOString()
                        .split("T")[0]
                    : ""
                }
              />
              <p className="text-xs text-gray-500">
                비워두면 발행 시 현재 날짜가 사용됩니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">태그</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={defaultValues?.tags?.join(", ")}
                placeholder="태그1, 태그2, 태그3"
              />
              <p className="text-xs text-gray-500">콤마로 구분해주세요</p>
            </div>

            <div className="flex flex-wrap gap-6 rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={defaultValues?.isFeatured ?? false}
                  className="h-4 w-4 accent-[#1c1b1b]"
                />
                추천 기사
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isPremium"
                  defaultChecked={defaultValues?.isPremium ?? false}
                  className="h-4 w-4 accent-[#6f5c24]"
                />
                프리미엄(등급 제한)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="aiIndexable"
                  defaultChecked={defaultValues?.aiIndexable ?? true}
                  className="h-4 w-4 accent-[#1c1b1b]"
                />
                AI 학습 허용
              </label>
            </div>

            <div className="space-y-2">
              <Label>썸네일</Label>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  isDragActive
                    ? "border-gray-900 bg-gray-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                {uploading ? (
                  <p className="text-sm text-gray-500">업로드 중...</p>
                ) : thumbnailUrl ? (
                  <div className="relative mx-auto aspect-video w-full max-w-xs overflow-hidden rounded">
                    <img
                      src={thumbnailUrl}
                      alt="썸네일 미리보기"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">
                      클릭하거나 이미지를 드래그하세요
                    </p>
                    <p className="text-xs text-gray-400">
                      권장 사이즈: 1200 x 675px (16:9 비율)
                    </p>
                    <p className="text-xs text-gray-400">JPG, PNG, WebP</p>
                  </div>
                )}
              </div>
              {thumbnailUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setThumbnailUrl("")}
                >
                  썸네일 제거
                </Button>
              )}
            </div>

            {state?.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}

            {/* 생성 페이지(formId 없음)에서의 제출 버튼. 수정 페이지는 상단 상태액션의 "저장" 사용 */}
            {!formId && (
              <Button type="submit" disabled={isPending || uploading}>
                {isPending ? "저장 중..." : "생성"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>본문</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor content={content} onChange={setContent} />
        </CardContent>
      </Card>
    </div>
  );
}

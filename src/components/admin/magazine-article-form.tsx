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

const SECTIONS = [
  "커버스토리",
  "인터뷰",
  "리뷰",
  "스페셜",
  "공연·티켓·교육",
  "기획",
];

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
    author?: string;
    section?: string;
    content?: string;
    thumbnailUrl?: string | null;
    publishedAt?: Date | null;
    isCoverStory?: boolean;
  };
  formId?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  const [content, setContent] = useState(defaultValues?.content || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    defaultValues?.thumbnailUrl || ""
  );
  const [title, setTitle] = useState(defaultValues?.title || "");
  const [slug, setSlug] = useState(defaultValues?.slug || "");
  const [section, setSection] = useState(defaultValues?.section || "");
  const [author, setAuthor] = useState(defaultValues?.author || "");
  const [publishedAt, setPublishedAt] = useState(
    defaultValues?.publishedAt
      ? new Date(defaultValues.publishedAt).toISOString().split("T")[0]
      : ""
  );
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success("저장되었습니다");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    try {
      setThumbnailUrl(await uploadBlogImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다");
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
    accept: Object.fromEntries(ACCEPTED_IMAGE_TYPES.map((t) => [t, []])),
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
          <CardTitle>아티클 정보</CardTitle>
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

            <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">섹션</Label>
                <Input
                  id="section"
                  name="section"
                  list="article-sections"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="커버스토리 / 인터뷰 …"
                />
                <datalist id="article-sections">
                  {SECTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="author">작성자</Label>
                <Input
                  id="author"
                  name="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="STAGE 편집부"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publishedAt">작성날짜</Label>
                <Input
                  id="publishedAt"
                  name="publishedAt"
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isCoverStory"
                value="true"
                defaultChecked={defaultValues?.isCoverStory}
                className="h-4 w-4"
              />
              커버스토리로 지정 (호당 1편 권장)
            </label>

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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailUrl}
                      alt="썸네일 미리보기"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    클릭하거나 이미지를 드래그하세요 (JPG/PNG/WebP)
                  </p>
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

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
import {
  ARTICLE_GENRES,
  ARTICLE_SUBCATEGORIES,
  ARTICLE_HERO_ASPECTS,
  heroAspectRatio,
} from "@/lib/article-taxonomy";
import { FocusPicker } from "@/components/admin/focus-picker";

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
    subtitle?: string | null;
    excerpt?: string | null;
    author?: string;
    genre?: string | null;
    subCategory?: string | null;
    tags?: string[];
    content?: string;
    thumbnailUrl?: string | null;
    thumbnailFocusX?: number | null;
    thumbnailFocusY?: number | null;
    thumbnailZoom?: number | null;
    heroAspect?: string | null;
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
  // 썸네일 비파괴 크롭(초점+줌)
  const [focusX, setFocusX] = useState(defaultValues?.thumbnailFocusX ?? 50);
  const [focusY, setFocusY] = useState(defaultValues?.thumbnailFocusY ?? 50);
  const [zoom, setZoom] = useState(defaultValues?.thumbnailZoom ?? 1);
  const [heroAspect, setHeroAspect] = useState(
    defaultValues?.heroAspect ?? "standard",
  );

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
      // 새 이미지 업로드 시 크롭 초기화
      setFocusX(50);
      setFocusY(50);
      setZoom(1);
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
            <input type="hidden" name="thumbnailFocusX" value={focusX} />
            <input type="hidden" name="thumbnailFocusY" value={focusY} />
            <input type="hidden" name="thumbnailZoom" value={zoom} />
            <input type="hidden" name="heroAspect" value={heroAspect} />

            <p className="text-xs text-gray-500">
              <span className="text-red-500">＊</span> 발행에 필요한 항목입니다.
              기고 요청만 만들 때는 비워둬도 됩니다(발행 시 확인).
            </p>

            <div className="space-y-2">
              <Label htmlFor="title">
                제목 <span className="text-red-500">＊</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">부제 (소제목)</Label>
              <Input
                id="subtitle"
                name="subtitle"
                defaultValue={defaultValues?.subtitle ?? ""}
                maxLength={300}
                placeholder="제목 아래 표시되는 한 줄"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                슬러그 <span className="text-red-500">＊</span>
              </Label>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="비우면 자동 생성"
              />
              <p className="text-xs text-gray-500">
                URL에 사용됩니다: /articles/{slug || "(자동)"}
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="author">작성자</Label>
                <Input
                  id="author"
                  name="author"
                  defaultValue={defaultValues?.author}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genre">장르</Label>
                <select
                  id="genre"
                  name="genre"
                  defaultValue={defaultValues?.genre ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">선택 안 함</option>
                  {ARTICLE_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCategory">유형</Label>
                <Input
                  id="subCategory"
                  name="subCategory"
                  list="article-subcats"
                  defaultValue={defaultValues?.subCategory ?? ""}
                  placeholder="리뷰·인터뷰·칼럼 등 (직접입력 가능)"
                />
                <datalist id="article-subcats">
                  {ARTICLE_SUBCATEGORIES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
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
                  <div className="relative mx-auto aspect-video w-full max-w-xs overflow-hidden rounded bg-gray-50">
                    <img
                      src={thumbnailUrl}
                      alt="업로드된 원본"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                      원본 (클릭해 교체)
                    </span>
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
                <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                  <FocusPicker
                    src={thumbnailUrl}
                    focusX={focusX}
                    focusY={focusY}
                    zoom={zoom}
                    onChange={(x, y) => {
                      setFocusX(x);
                      setFocusY(y);
                    }}
                    onZoomChange={setZoom}
                  />

                  {/* 결과 미리보기 — 같은 초점·줌이 비율이 다른 두 곳에 어떻게 적용되는지 */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-gray-600">
                      결과 미리보기 (목록 카드 · 상세 히어로)
                    </span>
                    <div className="flex gap-2">
                      <div className="w-1/2 space-y-0.5">
                        <span className="block text-[10px] text-gray-400">
                          목록 카드 (16:9)
                        </span>
                        <div className="aspect-video w-full overflow-hidden rounded border bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbnailUrl}
                            alt="카드 미리보기"
                            className="h-full w-full object-cover"
                            style={{
                              objectPosition: `${focusX}% ${focusY}%`,
                              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-1/2 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">
                            상세 히어로
                          </span>
                          <select
                            value={heroAspect}
                            onChange={(e) => setHeroAspect(e.target.value)}
                            className="rounded border px-1 py-0.5 text-[10px]"
                            aria-label="히어로 비율"
                          >
                            {ARTICLE_HERO_ASPECTS.map((a) => (
                              <option key={a.key} value={a.key}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div
                          className="w-full overflow-hidden rounded border bg-gray-100"
                          style={{ aspectRatio: heroAspectRatio(heroAspect) }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbnailUrl}
                            alt="히어로 미리보기"
                            className="h-full w-full object-cover"
                            style={{
                              objectPosition: `${focusX}% ${focusY}%`,
                              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    초점·줌은 카드/상세 썸네일 크롭에만 적용되며 원본은 보존됩니다.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFocusX(50);
                        setFocusY(50);
                        setZoom(1);
                      }}
                    >
                      크롭 초기화
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setThumbnailUrl("")}
                    >
                      썸네일 제거
                    </Button>
                  </div>
                </div>
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

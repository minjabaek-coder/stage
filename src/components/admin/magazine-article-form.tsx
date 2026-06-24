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
} from "@/lib/article-taxonomy";

type FormState = { error?: string; success?: boolean } | undefined;

const SECTIONS = [
  "커버스토리",
  "인터뷰",
  "리뷰",
  "스페셜",
  "공연·티켓·교육",
  "기획",
];

// 배경 이미지 오버레이 모드 설정. eBook 뷰어가 그대로 읽어 렌더링.
type ArticleLayout = {
  bgMode?: boolean;
  bgImageUrl?: string;
  bgDarkness?: number;
  titleColor?: string;
  bodyColor?: string;
  labelColor?: string;
};

// 색상 프리셋 (배경 위 가독성 고려). 값은 그대로 인라인 style에 들어감.
const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: "흰색", value: "#ffffff" },
  { label: "연한 흰색", value: "rgba(255,255,255,0.85)" },
  { label: "골드", value: "#c4a35a" },
  { label: "검정", value: "#1c1b1b" },
];

function ColorChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            aria-label={`${label} ${p.label}`}
            title={p.label}
            className={`h-7 w-7 rounded-full border transition ${
              value === p.value
                ? "ring-2 ring-gray-900 ring-offset-1"
                : "border-gray-300"
            }`}
            style={{ backgroundColor: p.value }}
          />
        ))}
      </div>
    </div>
  );
}

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
    genre?: string | null;
    subCategory?: string | null;
    content?: string;
    thumbnailUrl?: string | null;
    publishedAt?: Date | null;
    isCoverStory?: boolean;
    layoutOptions?: ArticleLayout | null;
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

  // 배경 이미지 오버레이 모드
  const initLayout = defaultValues?.layoutOptions ?? null;
  const [bgMode, setBgMode] = useState(!!initLayout?.bgMode);
  const [bgImageUrl, setBgImageUrl] = useState(initLayout?.bgImageUrl || "");
  const [bgDarkness, setBgDarkness] = useState(initLayout?.bgDarkness ?? 60);
  const [titleColor, setTitleColor] = useState(
    initLayout?.titleColor || "#c4a35a"
  );
  const [bodyColor, setBodyColor] = useState(initLayout?.bodyColor || "#ffffff");
  const [labelColor, setLabelColor] = useState(
    initLayout?.labelColor || "#ffffff"
  );
  const [bgUploading, setBgUploading] = useState(false);

  const layoutOptionsJson = bgMode
    ? JSON.stringify({
        bgMode: true,
        bgImageUrl,
        bgDarkness,
        titleColor,
        bodyColor,
        labelColor,
      })
    : "";

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

  const onDropBg = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setBgUploading(true);
    try {
      setBgImageUrl(await uploadBlogImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다");
    }
    setBgUploading(false);
  }, []);

  const bgDropzone = useDropzone({
    onDrop: onDropBg,
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
            <input type="hidden" name="layoutOptions" value={layoutOptionsJson} />

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
                <Label htmlFor="section">섹션 (뷰어 표시용)</Label>
                <Input
                  id="section"
                  name="section"
                  list="article-sections"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="커버스토리 / 오페라산책 …"
                />
                <datalist id="article-sections">
                  {SECTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* 택소노미(목록 필터·카드용) — 단독기사와 공유. 섹션과 별개. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="genre">장르 (목록 분류)</Label>
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
                <Label htmlFor="subCategory">유형 (목록 분류)</Label>
                <Input
                  id="subCategory"
                  name="subCategory"
                  list="mag-article-subcats"
                  defaultValue={defaultValues?.subCategory ?? ""}
                  placeholder="리뷰·인터뷰·칼럼 등 (직접입력 가능)"
                />
                <datalist id="mag-article-subcats">
                  {ARTICLE_SUBCATEGORIES.map((s) => (
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
          <CardTitle>배경 이미지 모드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={bgMode}
              onChange={(e) => setBgMode(e.target.checked)}
              className="h-4 w-4"
            />
            그림을 배경으로 (페이지 전체에 이미지를 깔고 텍스트를 위에 표시)
          </label>

          {bgMode && (
            <div className="space-y-5 rounded-lg border border-gray-200 p-4">
              {/* 배경 이미지 업로드 */}
              <div className="space-y-2">
                <Label>배경 이미지</Label>
                <div
                  {...bgDropzone.getRootProps()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                    bgDropzone.isDragActive
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <input {...bgDropzone.getInputProps()} />
                  {bgUploading ? (
                    <p className="text-sm text-gray-500">업로드 중...</p>
                  ) : bgImageUrl ? (
                    <div className="relative mx-auto aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bgImageUrl}
                        alt="배경 미리보기"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      클릭하거나 이미지를 드래그하세요 (세로형 권장)
                    </p>
                  )}
                </div>
                {bgImageUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBgImageUrl("")}
                  >
                    배경 이미지 제거
                  </Button>
                )}
              </div>

              {/* 어둠 강도 */}
              <div className="space-y-2">
                <Label htmlFor="bgDarkness">
                  어둠 강도 ({bgDarkness}%) — 글자 가독성 조절
                </Label>
                <input
                  id="bgDarkness"
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={bgDarkness}
                  onChange={(e) => setBgDarkness(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* 색상 */}
              <div className="grid gap-4 sm:grid-cols-3">
                <ColorChoice
                  label="제목 색"
                  value={titleColor}
                  onChange={setTitleColor}
                />
                <ColorChoice
                  label="본문 색"
                  value={bodyColor}
                  onChange={setBodyColor}
                />
                <ColorChoice
                  label="섹션·저자 색"
                  value={labelColor}
                  onChange={setLabelColor}
                />
              </div>

              {/* 라이브 미리보기 */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-600">
                  미리보기
                </span>
                <div className="relative aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded-lg bg-gray-200">
                  {bgImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bgImageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: `rgba(0,0,0,${bgDarkness / 100})` }}
                  />
                  <div className="absolute inset-0 flex flex-col justify-end p-4">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: labelColor }}
                    >
                      {section || "섹션"}
                    </span>
                    <span
                      className="font-headline mt-1 text-lg leading-tight"
                      style={{ color: titleColor }}
                    >
                      {title || "기사 제목"}
                    </span>
                    <span
                      className="mt-2 text-xs leading-snug"
                      style={{ color: bodyColor }}
                    >
                      본문 텍스트가 이 색상으로 표시됩니다.
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                현재 eBook 뷰어는 단일 페이지 구조라 한 페이지 전체에 적용됩니다.
                (양면 펼침/오른쪽 페이지 배경은 추후 지원)
              </p>
            </div>
          )}
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

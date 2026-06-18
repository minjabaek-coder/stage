"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { uploadBlogImage } from "@/lib/upload-client";

type FormState = { error?: string; success?: boolean } | undefined;

const TYPES = ["공연", "전시", "교육"];

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[가-힣]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `event-${Date.now()}`;
}

function toLocalInput(d?: Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const fieldClass =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CultureEventForm({
  action,
  defaultValues,
  formId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    title?: string;
    slug?: string;
    type?: string;
    genre?: string[];
    venue?: string;
    address?: string | null;
    artists?: string[];
    description?: string | null;
    thumbnailUrl?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    ticketUrl?: string | null;
    ticketPrice?: string | null;
    memberDiscount?: number;
    eduInstructor?: string | null;
    eduSchedule?: string | null;
    maxParticipants?: number | null;
    applyUrl?: string | null;
    isFeatured?: boolean;
    publishedAt?: Date | null;
  };
  formId?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [thumbnailUrl, setThumbnailUrl] = useState(
    defaultValues?.thumbnailUrl || ""
  );
  const [slug, setSlug] = useState(defaultValues?.slug || "");
  const [title, setTitle] = useState(defaultValues?.title || "");
  const [type, setType] = useState(defaultValues?.type || "공연");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success("저장되었습니다");
      router.push("/admin/culture-events");
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
    accept: Object.fromEntries(ACCEPTED_IMAGE_TYPES.map((t) => [t, []])),
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!defaultValues?.slug) setSlug(slugify(value));
  }

  const isEdu = type === "교육";

  return (
    <Card>
      <CardHeader>
        <CardTitle>문화예술 이벤트</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={formId} action={formAction} className="space-y-4">
          <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">유형</Label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={fieldClass}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="genre">장르</Label>
              <Input
                id="genre"
                name="genre"
                defaultValue={defaultValues?.genre?.join(", ")}
                placeholder="클래식, 발레 (콤마 구분)"
              />
            </div>
          </div>

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
              URL: /culture-events/{slug || "..."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={defaultValues?.description || ""}
              rows={4}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="venue">장소</Label>
              <Input
                id="venue"
                name="venue"
                defaultValue={defaultValues?.venue}
                placeholder="예술의전당 콘서트홀"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                name="address"
                defaultValue={defaultValues?.address || ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="artists">출연/작가</Label>
            <Input
              id="artists"
              name="artists"
              defaultValue={defaultValues?.artists?.join(", ")}
              placeholder="콤마로 구분"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">시작 일시</Label>
              <input
                id="startDate"
                name="startDate"
                type="datetime-local"
                required
                defaultValue={toLocalInput(defaultValues?.startDate)}
                className={fieldClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">종료 일시</Label>
              <input
                id="endDate"
                name="endDate"
                type="datetime-local"
                defaultValue={toLocalInput(defaultValues?.endDate)}
                className={fieldClass}
              />
            </div>
          </div>

          {/* 공연·전시: 티켓 / 교육: 신청 */}
          {isEdu ? (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
              <div className="space-y-2">
                <Label htmlFor="eduInstructor">강사</Label>
                <Input
                  id="eduInstructor"
                  name="eduInstructor"
                  defaultValue={defaultValues?.eduInstructor || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eduSchedule">일정 안내</Label>
                <Input
                  id="eduSchedule"
                  name="eduSchedule"
                  defaultValue={defaultValues?.eduSchedule || ""}
                  placeholder="매주 토 14:00 (4주)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">정원</Label>
                <Input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  min={0}
                  defaultValue={defaultValues?.maxParticipants ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="applyUrl">신청 링크</Label>
                <Input
                  id="applyUrl"
                  name="applyUrl"
                  defaultValue={defaultValues?.applyUrl || ""}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
              <div className="space-y-2">
                <Label htmlFor="ticketUrl">예매 링크</Label>
                <Input
                  id="ticketUrl"
                  name="ticketUrl"
                  defaultValue={defaultValues?.ticketUrl || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketPrice">가격</Label>
                <Input
                  id="ticketPrice"
                  name="ticketPrice"
                  defaultValue={defaultValues?.ticketPrice || ""}
                  placeholder="R석 100,000원"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberDiscount">회원 할인(%)</Label>
                <Input
                  id="memberDiscount"
                  name="memberDiscount"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={defaultValues?.memberDiscount ?? 0}
                />
              </div>
            </div>
          )}

          {/* 교육일 때도 회원 할인 입력 가능하도록 hidden 유지 (티켓 섹션이 숨겨질 때 0 제출) */}
          {isEdu && (
            <input type="hidden" name="memberDiscount" value="0" />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publishedAt">발행일</Label>
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
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={defaultValues?.isFeatured ?? false}
                className="h-4 w-4 accent-[#6f5c24]"
              />
              추천 이벤트
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
                <p className="text-sm text-gray-500">
                  클릭하거나 이미지를 드래그하세요
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

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          {!formId && (
            <Button type="submit" disabled={isPending || uploading}>
              {isPending ? "저장 중..." : "생성"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

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
import { AD_PLACEMENTS } from "@/lib/ad-placements";

type FormState = { error?: string; success?: boolean } | undefined;

const TYPES = ["배너", "네이티브", "후원"];

// 주의: display:flex를 네이티브 <select>에 주면 일부 브라우저(Chrome)가 옵션 팝업을
// 비정상 렌더한다(큰 창/다른 위치). textarea·select에는 block을 쓴다.
const fieldClass =
  "block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function toDateInput(d?: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function AdForm({
  action,
  defaultValues,
  formId,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    sponsor?: string;
    title?: string;
    description?: string | null;
    imageUrl?: string | null;
    linkUrl?: string;
    type?: string;
    placement?: string[];
    isActive?: boolean;
    startDate?: Date | null;
    endDate?: Date | null;
  };
  formId?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [imageUrl, setImageUrl] = useState(defaultValues?.imageUrl || "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success("저장되었습니다");
      router.push("/admin/ads");
    }
  }, [state, router]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadBlogImage(file));
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>광고 정보</CardTitle>
      </CardHeader>
      <CardContent>
        <form id={formId} action={formAction} className="space-y-4">
          <input type="hidden" name="imageUrl" value={imageUrl} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sponsor">스폰서</Label>
              <Input
                id="sponsor"
                name="sponsor"
                defaultValue={defaultValues?.sponsor}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">유형</Label>
              <select
                id="type"
                name="type"
                defaultValue={defaultValues?.type || "배너"}
                className={fieldClass}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              name="title"
              defaultValue={defaultValues?.title}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <textarea
              id="description"
              name="description"
              defaultValue={defaultValues?.description || ""}
              rows={2}
              className={fieldClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkUrl">링크 URL</Label>
            <Input
              id="linkUrl"
              name="linkUrl"
              type="url"
              defaultValue={defaultValues?.linkUrl}
              placeholder="https://..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>노출 위치</Label>
            <div className="flex flex-wrap gap-4 rounded-lg border border-gray-200 p-3">
              {AD_PLACEMENTS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="placement"
                    value={p.value}
                    defaultChecked={defaultValues?.placement?.includes(p.value)}
                    className="h-4 w-4 accent-[#1c1b1b]"
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              선택한 위치의 공개 페이지에 노출됩니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">시작일</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={toDateInput(defaultValues?.startDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">종료일</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={toDateInput(defaultValues?.endDate)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaultValues?.isActive ?? true}
              className="h-4 w-4 accent-[#1c1b1b]"
            />
            활성(노출 대상)
          </label>

          <div className="space-y-2">
            <Label>이미지</Label>
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
              ) : imageUrl ? (
                <div className="relative mx-auto aspect-video w-full max-w-xs overflow-hidden rounded">
                  <img
                    src={imageUrl}
                    alt="광고 미리보기"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  클릭하거나 이미지를 드래그하세요
                </p>
              )}
            </div>
            {imageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImageUrl("")}
              >
                이미지 제거
              </Button>
            )}
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <Button type="submit" disabled={isPending || uploading}>
            {isPending ? "저장 중..." : defaultValues ? "저장" : "생성"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

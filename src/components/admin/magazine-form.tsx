"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type FormState = { error?: string; success?: boolean } | undefined;

export function MagazineForm({
  action,
  defaultValues,
  submitLabel = "저장",
  formId,
  showContentType = false,
  bare = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: {
    issueNumber?: number;
    title?: string;
    description?: string | null;
    publishedAt?: Date | null;
    contentType?: string;
  };
  submitLabel?: string;
  formId?: string;
  showContentType?: boolean;
  bare?: boolean; // true면 카드/헤더 없이 폼만(접이식 패널 안에서 "매거진 정보" 중복 방지)
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("저장되었습니다");
    }
  }, [state]);

  const inner = (
    <form id={formId} action={formAction} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="issueNumber">호수</Label>
            <Input
              id="issueNumber"
              name="issueNumber"
              type="number"
              min={1}
              defaultValue={defaultValues?.issueNumber}
              required
            />
          </div>
          {showContentType && (
            <div className="space-y-2">
              <Label htmlFor="contentType">콘텐츠 방식</Label>
              <select
                id="contentType"
                name="contentType"
                defaultValue={defaultValues?.contentType ?? "image"}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="image">이미지 업로드 (1~38호 방식)</option>
                <option value="composed">구성형 — CMS 자유배치 (39호+)</option>
              </select>
              <p className="text-xs text-gray-500">
                생성 후에는 변경할 수 없습니다.
              </p>
            </div>
          )}
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
            <Input
              id="description"
              name="description"
              defaultValue={defaultValues?.description ?? ""}
              placeholder="매거진 설명 (선택)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="publishedAt">발행날짜</Label>
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
          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : submitLabel}
          </Button>
        </form>
  );

  if (bare) return inner;

  return (
    <Card>
      <CardHeader>
        <CardTitle>매거진 정보</CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}

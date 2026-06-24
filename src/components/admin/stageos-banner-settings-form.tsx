"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveStageOsBanner } from "@/actions/site-settings-actions";
import type { StageOsBannerConfig } from "@/lib/site-settings";

type State = { error?: string; success?: boolean } | undefined;

export function StageOsBannerSettingsForm({
  initial,
}: {
  initial: StageOsBannerConfig;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    saveStageOsBanner,
    undefined,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success) toast.success("저장되었습니다");
  }, [state]);

  const labelClass = "text-sm font-medium";
  const fieldClass =
    "mt-1 w-full rounded-md border px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">StageOS 프로모 배너</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initial.enabled}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">배너 노출</span>
            <span className="text-xs text-muted-foreground">
              끄면 모든 공개 페이지에서 배너가 사라집니다
            </span>
          </label>

          <div>
            <label htmlFor="eyebrow" className={labelClass}>
              상단 라벨
            </label>
            <input
              id="eyebrow"
              name="eyebrow"
              defaultValue={initial.eyebrow}
              maxLength={80}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="headline" className={labelClass}>
              헤드라인
            </label>
            <textarea
              id="headline"
              name="headline"
              required
              rows={2}
              defaultValue={initial.headline}
              maxLength={200}
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              데스크탑에서 한 줄로 잘립니다. 핵심 문구를 앞쪽에 배치하세요.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ctaLabel" className={labelClass}>
                버튼 문구
              </label>
              <input
                id="ctaLabel"
                name="ctaLabel"
                defaultValue={initial.ctaLabel}
                maxLength={40}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="ctaHref" className={labelClass}>
                버튼 링크
              </label>
              <input
                id="ctaHref"
                name="ctaHref"
                required
                defaultValue={initial.ctaHref}
                maxLength={300}
                placeholder="/stageos"
                className={fieldClass}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

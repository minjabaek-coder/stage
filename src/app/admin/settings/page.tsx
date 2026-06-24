export const dynamic = "force-dynamic";

import { getStageOsBanner } from "@/lib/site-settings";
import { StageOsBannerSettingsForm } from "@/components/admin/stageos-banner-settings-form";

export default async function AdminSettingsPage() {
  const banner = await getStageOsBanner();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사이트 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          공개 페이지 전역에 적용되는 설정형 항목입니다.
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
        <StageOsBannerSettingsForm initial={banner} />
      </div>
    </div>
  );
}

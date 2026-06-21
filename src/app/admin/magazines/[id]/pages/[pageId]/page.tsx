export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ComposedPage } from "@/components/public/composed-page";
import { parsePageLayout } from "@/types/magazine-layout";

// 구성형 페이지 에디터 — D3a에서는 라우트/미리보기 stub. 자유배치 캔버스 에디터는 D3b.
export default async function ComposedPageEditor({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id, pageId } = await params;
  const page = await prisma.magazinePage.findUnique({ where: { id: pageId } });
  if (!page || page.magazineId !== id) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/magazines/${id}/edit`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 매거진
        </Link>
        <h1 className="text-2xl font-bold">페이지 편집 — P.{page.pageNumber}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">미리보기 (현재 레이아웃)</p>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border bg-neutral-900">
            <ComposedPage layout={parsePageLayout(page.layout)} />
          </div>
        </div>
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          자유배치 캔버스 에디터(블록 추가·드래그·리사이즈·속성)는 다음 단계(D3b)에서
          구현됩니다. 현재는 라우트·미리보기 확인용입니다.
        </div>
      </div>
    </div>
  );
}

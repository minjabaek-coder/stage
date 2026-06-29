export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { MainLayout } from "@/components/layouts/main-layout";
import { MagazineGrid } from "@/components/public/magazine-grid";
import { AdSlot } from "@/components/public/ad-slot";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "전체 매거진 | STAGE",
  description: "STAGE의 모든 발행 호를 만나보세요.",
};

export default async function MagazinesPage() {
  const rows = await prisma.magazine.findMany({
    where: { status: "published" },
    orderBy: { issueNumber: "desc" },
    // 구성형 표지 폴백용 첫 페이지 layout
    include: {
      pages: { orderBy: { sortOrder: "asc" }, take: 1, select: { layout: true } },
    },
  });
  const magazines = rows.map((m) => ({
    id: m.id,
    issueNumber: m.issueNumber,
    title: m.title,
    coverImageUrl: m.coverImageUrl,
    publishedAt: m.publishedAt,
    contentType: m.contentType,
    coverLayout: m.contentType === "composed" ? m.pages[0]?.layout ?? null : null,
  }));

  return (
    <MainLayout showGenreNav={false}>
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-gold-deep">
        Archive
      </span>
      <h1 className="font-headline mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        전체 매거진
      </h1>
      <p className="mt-2 text-sm text-taupe">총 {magazines.length}호 발행</p>

      <MagazineGrid magazines={magazines} />

      <AdSlot placement="magazines" className="mt-12 block" />
    </MainLayout>
  );
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { MagazineReader } from "@/components/public/magazine-reader";
import { ViewTracker } from "@/components/public/view-tracker";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string }>;
};

// 비프로덕션(preview·로컬)에서는 미발행(draft) 매거진/아티클도 열람 허용 — 39호 등
// 작업본을 preview에서 미리보기 위함. 프로덕션(bon-stage.com)에서는 발행본만 노출.
const ALLOW_DRAFT = process.env.VERCEL_ENV !== "production";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const magazine = await prisma.magazine.findUnique({ where: { id } });

  if (!magazine || (magazine.status !== "published" && !ALLOW_DRAFT && !(await isAdmin()))) {
    return { title: "Not Found" };
  }

  const description =
    magazine.description ||
    `STAGE ${magazine.issueNumber}호 — ${magazine.title}`;

  return {
    title: `${magazine.title} | STAGE`,
    description,
    alternates: { canonical: `/magazines/${magazine.id}` },
    openGraph: {
      type: "article",
      title: magazine.title,
      description,
      url: `/magazines/${magazine.id}`,
      images: magazine.coverImageUrl
        ? [{ url: magazine.coverImageUrl }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: magazine.title,
      description,
    },
  };
}

export default async function MagazineViewerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { page: pageParam } = (await searchParams) ?? {};
  const initialPage = Math.max(1, Number(pageParam) || 1);

  const magazine = await prisma.magazine.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      tocEntries: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!magazine || (magazine.status !== "published" && !ALLOW_DRAFT && !(await isAdmin()))) {
    notFound();
  }

  // 모든 매거진(이미지형 1~38호 · 구성형 39호~)을 동일한 통합 뷰어로 표시.
  // 헤더(Issue·제목·닫기)·컨트롤·진행률은 뷰어가 소유(rev.3 리더 크롬).
  return (
    <div
      className="flex h-dvh flex-col bg-ink-deep"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ViewTracker type="magazine" id={magazine.id} />
      <MagazineReader
        pages={magazine.pages}
        tocEntries={magazine.tocEntries}
        initialPage={initialPage}
        issueNumber={magazine.issueNumber}
        title={magazine.title}
      />
    </div>
  );
}

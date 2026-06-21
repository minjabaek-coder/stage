export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MagazineReader } from "@/components/public/magazine-reader";
import { ViewTracker } from "@/components/public/view-tracker";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

// 비프로덕션(preview·로컬)에서는 미발행(draft) 매거진/아티클도 열람 허용 — 39호 등
// 작업본을 preview에서 미리보기 위함. 프로덕션(bon-stage.com)에서는 발행본만 노출.
const ALLOW_DRAFT = process.env.VERCEL_ENV !== "production";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const magazine = await prisma.magazine.findUnique({ where: { id } });

  if (!magazine || (magazine.status !== "published" && !ALLOW_DRAFT)) {
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

export default async function MagazineViewerPage({ params }: Props) {
  const { id } = await params;

  const magazine = await prisma.magazine.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      tocEntries: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!magazine || (magazine.status !== "published" && !ALLOW_DRAFT)) {
    notFound();
  }

  // 모든 매거진(이미지형 1~38호 · 구성형 39호~)을 동일한 플립 뷰어로 표시.
  return (
    <div className="flex h-dvh flex-col bg-gray-950" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ViewTracker type="magazine" id={magazine.id} />
      <header className="hidden md:flex h-12 flex-shrink-0 items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-white"
        >
          STAGE
        </Link>
        <span className="text-sm text-gray-400">
          {magazine.title}
        </span>
      </header>
      <div className="relative flex-1 overflow-hidden">
        <MagazineReader pages={magazine.pages} tocEntries={magazine.tocEntries} />
        <div className="absolute bottom-4 left-0 right-0 flex md:hidden items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-gray-300 backdrop-blur-sm transition-colors hover:text-white"
          >
            &larr; 메인으로
          </Link>
          <Link
            href="/magazines"
            className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-gray-300 backdrop-blur-sm transition-colors hover:text-white"
          >
            매거진 목록
          </Link>
        </div>
      </div>
      <div className="hidden md:flex flex-shrink-0 items-center justify-center gap-4 border-t border-white/10 py-3 px-4">
        <Link
          href="/"
          className="text-sm text-gray-400 transition-colors hover:text-white"
        >
          &larr; 메인으로
        </Link>
        <span className="text-gray-700">|</span>
        <Link
          href="/magazines"
          className="text-sm text-gray-400 transition-colors hover:text-white"
        >
          매거진 목록
        </Link>
      </div>
    </div>
  );
}

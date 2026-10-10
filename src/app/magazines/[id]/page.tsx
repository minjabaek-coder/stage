export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { safeRead } from "@/lib/db-safe";
import { tryIsAdmin } from "@/lib/auth";
import { MagazineReader } from "@/components/public/magazine-reader";
import { ViewTracker } from "@/components/public/view-tracker";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string }>;
};

// 발행 전(draft/unpublished) 매거진은 관리자만 열람(미리보기). 환경 무관 — 비admin은 404.
// (구 ALLOW_DRAFT 환경 분기는 preview URL 유출 시 발행 전 노출 → 권한 기반으로 전환)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // generateMetadata에서 throw하면 본문이 멀쩡해도 라우트 전체가 500이 된다.
  const { data: magazine } = await safeRead(
    () => prisma.magazine.findUnique({ where: { id } }),
    null,
    "magazineViewer:metadata"
  );

  if (!magazine || (magazine.status !== "published" && !(await tryIsAdmin()))) {
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

// 뷰어는 전체화면 라우트(공용 셸 없음)라 안내도 자체적으로 그린다.
function MagazineUnavailable() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-ink-deep px-6 text-center">
      <p className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
        Temporarily Unavailable
      </p>
      <h1 className="font-headline text-xl font-bold text-white">
        지금 이 호를 열 수 없습니다
      </h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-white/60">
        일시적인 문제로 매거진 데이터를 읽지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
      <Link
        href="/"
        className="mt-3 border border-white/30 px-5 py-2.5 font-label text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:border-gold hover:text-gold"
      >
        홈으로
      </Link>
    </div>
  );
}

export default async function MagazineViewerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { page: pageParam } = (await searchParams) ?? {};
  const initialPage = Math.max(1, Number(pageParam) || 1);

  const read = await safeRead(
    () =>
      prisma.magazine.findUnique({
        where: { id },
        include: {
          pages: { orderBy: { sortOrder: "asc" } },
          tocEntries: { orderBy: { sortOrder: "asc" } },
        },
      }),
    null,
    "magazineViewer:load"
  );

  // DB 장애를 404로 보여주면 "이 호는 없다"는 **틀린 말**이 된다. 구분해서 알린다.
  if (!read.ok) return <MagazineUnavailable />;

  const magazine = read.data;
  if (!magazine || (magazine.status !== "published" && !(await tryIsAdmin()))) {
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

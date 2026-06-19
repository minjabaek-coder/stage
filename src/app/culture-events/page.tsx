export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MainLayout } from "@/components/layouts/main-layout";
import { CultureEventCard } from "@/components/public/culture-event-card";

export const metadata: Metadata = {
  title: "문화예술 | STAGE",
  description: "STAGE가 안내하는 공연·전시·교육 — 회원 할인 정보까지.",
};

// 전시·교육은 type, 그 외(클래식·오페라 등)는 genre 배열로 필터.
const TYPE_GENRES = ["전시", "교육"];

export default async function CultureEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const { genre } = await searchParams;
  const genreFilter = genre
    ? TYPE_GENRES.includes(genre)
      ? { type: genre }
      : { genre: { has: genre } }
    : {};

  const events = await prisma.cultureEvent.findMany({
    where: { status: "published", ...genreFilter },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      slug: true,
      type: true,
      genre: true,
      title: true,
      venue: true,
      startDate: true,
      endDate: true,
      thumbnailUrl: true,
      memberDiscount: true,
    },
  });

  return (
    <MainLayout>
      <h1 className="text-3xl font-bold tracking-tight">문화예술</h1>
      <p className="mt-2 text-gray-500">
        {genre ? `${genre} · ` : "공연 · 전시 · 교육 "}
        {events.length}건
      </p>

      {events.length === 0 ? (
        <div className="mt-24 text-center text-gray-400">
          {genre
            ? `'${genre}' 분야의 이벤트가 없습니다.`
            : "아직 등록된 이벤트가 없습니다."}
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <CultureEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </MainLayout>
  );
}

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { CultureEventCard } from "@/components/public/culture-event-card";

export const metadata: Metadata = {
  title: "문화예술 | STAGE",
  description: "STAGE가 안내하는 공연·전시·교육 — 회원 할인 정보까지.",
};

export default async function CultureEventsPage() {
  const events = await prisma.cultureEvent.findMany({
    where: { status: "published" },
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
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">문화예술</h1>
        <p className="mt-2 text-gray-500">공연 · 전시 · 교육 {events.length}건</p>

        {events.length === 0 ? (
          <div className="mt-24 text-center text-gray-400">
            아직 등록된 이벤트가 없습니다.
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <CultureEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

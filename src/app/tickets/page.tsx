export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { CultureEventCard } from "@/components/public/culture-event-card";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "회원 티켓 할인 | STAGE",
  description: "STAGE 회원이 누리는 공연·전시 티켓 할인 혜택.",
};

export default async function TicketsPage() {
  const [user, events] = await Promise.all([
    getCurrentUser(),
    prisma.cultureEvent.findMany({
      where: { status: "published", memberDiscount: { gt: 0 } },
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
    }),
  ]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <span className="font-label text-[11px] font-bold uppercase tracking-[0.25em] text-terra">
          Membership Benefit
        </span>
        <h1 className="font-headline mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          회원 티켓 할인
        </h1>
        <p className="mt-3 max-w-xl text-ink-muted">
          STAGE 회원이 되면 엄선한 공연·전시를 더 합리적인 가격에 만날 수 있습니다.
        </p>

        {/* 멤버십 안내 배너 */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-terra/25 bg-terra/5 p-6">
          {user ? (
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-terra">
                {user.name || "회원"}님
              </span>
              , 아래 공연·전시에서 회원 할인이 적용됩니다.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                회원가입 후 로그인하면 할인 혜택을 받을 수 있습니다.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/signup"
                  className="bg-ink px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-terra"
                >
                  회원가입
                </Link>
                <Link
                  href="/auth/login"
                  className="font-label text-[11px] font-bold uppercase tracking-widest text-terra transition-colors hover:underline"
                >
                  로그인
                </Link>
              </div>
            </>
          )}
        </div>

        {events.length === 0 ? (
          <div className="mt-24 text-center text-taupe">
            현재 진행 중인 할인 혜택이 없습니다.
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
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

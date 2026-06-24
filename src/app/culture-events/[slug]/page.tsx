export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";

const getEvent = cache(async (slug: string) => {
  return prisma.cultureEvent.findFirst({
    where: { slug, status: "published" },
  });
});

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Not Found" };

  const description =
    event.description?.slice(0, 160) ||
    `${event.venue} · ${event.type}`;

  return {
    title: `${event.title} | STAGE`,
    description,
    alternates: { canonical: `/culture-events/${event.slug}` },
    openGraph: {
      type: "article",
      title: event.title,
      description,
      url: `/culture-events/${event.slug}`,
      images: event.thumbnailUrl ? [{ url: event.thumbnailUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
    },
  };
}

export default async function CultureEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const isEdu = event.type === "교육";
  const ctaUrl = isEdu ? event.applyUrl : event.ticketUrl;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />

      {event.thumbnailUrl && (
        <div className="relative h-60 w-full sm:h-80 md:h-[26rem]">
          <img
            src={event.thumbnailUrl}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-paper" />
        </div>
      )}

      <main className="mx-auto max-w-[680px] px-6 pb-16 pt-8">
        {/* 브레드크럼 — 티켓 흐름 안에 있음을 표시(URL은 표준 culture-events 유지) */}
        <nav className="flex items-center gap-1.5 font-label text-[11px] uppercase tracking-wider text-taupe">
          <Link href="/tickets" className="transition-colors hover:text-terra">
            티켓
          </Link>
          <span aria-hidden>›</span>
          <span className="text-ink/70">{event.type}</span>
        </nav>

        <div className="mt-4 flex items-center gap-2">
          <span className="bg-ink/70 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-white">
            {event.type}
          </span>
          {event.genre.length > 0 && (
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-gold-deep">
              {event.genre.join(" · ")}
            </span>
          )}
        </div>

        <h1 className="font-headline mt-3 text-[28px] font-bold leading-[1.25] tracking-tight text-ink md:text-[40px] md:leading-[1.2]">
          {event.title}
        </h1>

        {/* 핵심 정보 */}
        <dl className="mt-6 space-y-2.5 text-sm">
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-taupe">일시</dt>
            <dd className="text-ink">
              {fmtDateTime(event.startDate)}
              {event.endDate ? ` ~ ${fmtDateTime(event.endDate)}` : ""}
            </dd>
          </div>
          {event.venue && (
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-taupe">장소</dt>
              <dd className="text-ink">
                {event.venue}
                {event.address ? (
                  <span className="text-taupe"> · {event.address}</span>
                ) : null}
              </dd>
            </div>
          )}
          {event.artists.length > 0 && (
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-taupe">
                {isEdu ? "강사" : "출연"}
              </dt>
              <dd className="text-ink">{event.artists.join(", ")}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className="mt-8 whitespace-pre-line text-[15px] leading-[1.9] text-ink-muted">
            {event.description}
          </p>
        )}

        {/* 예매/신청 박스 — 티켓 브랜드(terra) */}
        <div className="mt-10 border border-terra/25 bg-terra/5 p-6">
          {isEdu ? (
            <dl className="space-y-2 text-sm">
              {event.eduInstructor && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-taupe">강사</dt>
                  <dd className="text-ink">{event.eduInstructor}</dd>
                </div>
              )}
              {event.eduSchedule && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-taupe">일정</dt>
                  <dd className="text-ink">{event.eduSchedule}</dd>
                </div>
              )}
              {event.maxParticipants != null && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-taupe">정원</dt>
                  <dd className="text-ink">{event.maxParticipants}명</dd>
                </div>
              )}
            </dl>
          ) : (
            <dl className="space-y-2 text-sm">
              {event.ticketPrice && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-taupe">가격</dt>
                  <dd className="text-ink">{event.ticketPrice}</dd>
                </div>
              )}
              {event.memberDiscount > 0 && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-taupe">회원 혜택</dt>
                  <dd className="font-semibold text-terra">
                    STAGE 회원 {event.memberDiscount}% 할인
                  </dd>
                </div>
              )}
            </dl>
          )}

          {ctaUrl && (
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block bg-ink px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-terra"
            >
              {isEdu ? "신청하기" : "예매하기"}
            </a>
          )}
        </div>

        <div className="mt-12 border-t border-ink/10 pt-6">
          <Link
            href="/tickets"
            className="font-label text-xs uppercase tracking-wider text-terra transition-colors hover:underline"
          >
            ← 회원 티켓 할인
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

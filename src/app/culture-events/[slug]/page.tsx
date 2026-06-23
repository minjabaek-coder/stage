export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { Badge } from "@/components/ui/badge";

const getEvent = cache(async (slug: string) => {
  return prisma.cultureEvent.findFirst({
    where: { slug, status: "published" },
  });
});

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("ko-KR", {
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

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {event.thumbnailUrl && (
        <div className="relative h-64 w-full sm:h-80 md:h-96">
          <img
            src={event.thumbnailUrl}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}

      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{event.type}</Badge>
          {event.genre.length > 0 && (
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-[#6f5c24]">
              {event.genre.join(" · ")}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {event.title}
        </h1>

        {/* 핵심 정보 */}
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-gray-400">일시</dt>
            <dd>
              {fmtDateTime(event.startDate)}
              {event.endDate ? ` ~ ${fmtDateTime(event.endDate)}` : ""}
            </dd>
          </div>
          {event.venue && (
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-gray-400">장소</dt>
              <dd>
                {event.venue}
                {event.address ? (
                  <span className="text-gray-400"> · {event.address}</span>
                ) : null}
              </dd>
            </div>
          )}
          {event.artists.length > 0 && (
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-gray-400">
                {isEdu ? "강사" : "출연"}
              </dt>
              <dd>{event.artists.join(", ")}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className="mt-8 whitespace-pre-line leading-relaxed text-[#1c1b1b]">
            {event.description}
          </p>
        )}

        {/* 예매/신청 박스 */}
        <div className="mt-10 rounded-2xl border border-[#1c1b1b]/10 bg-[#faf7f2] p-6">
          {isEdu ? (
            <dl className="space-y-2 text-sm">
              {event.eduInstructor && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-gray-400">강사</dt>
                  <dd>{event.eduInstructor}</dd>
                </div>
              )}
              {event.eduSchedule && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-gray-400">일정</dt>
                  <dd>{event.eduSchedule}</dd>
                </div>
              )}
              {event.maxParticipants != null && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-gray-400">정원</dt>
                  <dd>{event.maxParticipants}명</dd>
                </div>
              )}
            </dl>
          ) : (
            <dl className="space-y-2 text-sm">
              {event.ticketPrice && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-gray-400">가격</dt>
                  <dd>{event.ticketPrice}</dd>
                </div>
              )}
              {event.memberDiscount > 0 && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-gray-400">회원 혜택</dt>
                  <dd className="font-medium text-[#6f5c24]">
                    STAGE 회원 {event.memberDiscount}% 할인
                  </dd>
                </div>
              )}
            </dl>
          )}

          {(isEdu ? event.applyUrl : event.ticketUrl) && (
            <a
              href={(isEdu ? event.applyUrl : event.ticketUrl) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
            >
              {isEdu ? "신청하기" : "예매하기"}
            </a>
          )}
        </div>

        <div className="mt-12 border-t border-gray-100 pt-6">
          <Link
            href="/tickets"
            className="font-label text-xs uppercase tracking-wider text-[#6f5c24] hover:underline"
          >
            ← 공연·전시·교육
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

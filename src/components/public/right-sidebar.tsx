import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatKSTDate } from "@/lib/format";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { SidebarAd } from "@/components/public/sidebar-ad";

// 우측 상시 사이드바 (데스크탑 lg+). 위젯: 광고 · 티켓 할인 · StageOS · 최근 기사 ·
// 뉴스레터. 데이터는 요청 시 조회(force-dynamic 페이지에서 사용).
export async function RightSidebar() {
  const now = new Date();
  const [user, ads, tickets, recentArticles] = await Promise.all([
    getCurrentUser(),
    prisma.advertisement.findMany({
      where: {
        isActive: true,
        placement: { has: "sidebar" },
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, sponsor: true, title: true, imageUrl: true },
    }),
    prisma.cultureEvent.findMany({
      where: {
        status: "published",
        memberDiscount: { gt: 0 },
        startDate: { gte: now },
      },
      orderBy: { startDate: "asc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        startDate: true,
        memberDiscount: true,
        thumbnailUrl: true,
      },
    }),
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: { id: true, slug: true, title: true },
    }),
  ]);

  const isMember = !!user; // member·pro 모두 할인 노출

  return (
    <aside className="hidden w-[280px] flex-shrink-0 lg:block">
      <div className="sticky top-[calc(3.5rem+3rem)] space-y-6">
        {/* ① 광고 */}
        {ads.length > 0 && <SidebarAd ads={ads} />}

        {/* ② 티켓 할인 */}
        {tickets.length > 0 && (
          <Widget title="🎟 이달의 티켓 할인">
            <ul className="space-y-3">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/culture-events/${t.slug}`}
                    className="group flex gap-3"
                  >
                    {t.thumbnailUrl && (
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.thumbnailUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-medium leading-snug text-[#1c1b1b] group-hover:text-[#6f5c24]">
                        {t.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {formatKSTDate(t.startDate)}
                      </p>
                      {isMember ? (
                        <span className="mt-0.5 inline-block font-label text-[10px] font-bold text-[#b5431a]">
                          회원 {t.memberDiscount}% 할인
                        </span>
                      ) : (
                        <span className="mt-0.5 inline-block font-label text-[10px] text-gray-400">
                          로그인 시 할인가
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <WidgetMore href="/tickets" label="전체 티켓 할인 보기" />
          </Widget>
        )}

        {/* ③ StageOS */}
        <Link
          href="/stageos"
          className="block rounded-lg bg-gradient-to-br from-[#0a0f1a] to-[#12193a] p-4 text-[#fcf9f8] transition-opacity hover:opacity-95"
        >
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[#a5b4fc]">
            ✦ StageOS
          </span>
          <p className="mt-2 text-sm leading-snug">
            문화예술 기관을 위한 AI 운영 플랫폼
          </p>
          <ul className="mt-2 space-y-0.5 text-[11px] text-[#c4c7d0]">
            <li>· 모바일 브로셔 자동 생성</li>
            <li>· 다국어 음성 해설</li>
            <li>· 관객 데이터 분석</li>
          </ul>
          <span className="mt-3 inline-block font-label text-[10px] uppercase tracking-widest text-[#a5b4fc]">
            자세히 보기 →
          </span>
        </Link>

        {/* ④ 최근 기사 */}
        {recentArticles.length > 0 && (
          <Widget title="최근 기사">
            <ul className="space-y-2">
              {recentArticles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/articles/${a.slug}`}
                    className="flex gap-1.5 text-xs leading-snug text-[#444748] hover:text-[#6f5c24]"
                  >
                    <span className="text-[#c4a35a]">·</span>
                    <span className="line-clamp-2">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Widget>
        )}

        {/* ⑤ 뉴스레터 */}
        <Widget title="📮 STAGE Weekly">
          <p className="mb-3 text-[11px] leading-relaxed text-gray-500">
            매주 토요일, 문화예술 이야기를 메일로.
          </p>
          <NewsletterForm source="sidebar" placeholder="이메일 주소" />
        </Widget>
      </div>
    </aside>
  );
}

function Widget({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#1c1b1b]/10 bg-[#faf7f4] p-4">
      <h3 className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-[#6f5c24]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function WidgetMore({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-3 block border-t border-[#1c1b1b]/8 pt-2 font-label text-[10px] uppercase tracking-wider text-gray-400 hover:text-[#6f5c24]"
    >
      {label} →
    </Link>
  );
}

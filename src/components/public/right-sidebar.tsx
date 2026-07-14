import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatKSTDate } from "@/lib/format";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { SidebarAd } from "@/components/public/sidebar-ad";

// 우측 상시 사이드바 (데스크탑 lg+). 위젯: 광고 · 티켓 할인 · StageOS · 최근 기사 ·
// 뉴스레터. v2 토큰(ink/gold/terra/widget-bg) 적용.
// hideRecent: 홈처럼 본문에 "최신 기사" 섹션이 있어 중복일 때 최근 기사 위젯 숨김.
export async function RightSidebar({
  hideRecent = false,
}: {
  hideRecent?: boolean;
} = {}) {
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
        startDate: { gte: now },
        OR: [{ sidebarFeatured: true }, { memberDiscount: { gt: 0 } }],
      },
      orderBy: [{ sidebarFeatured: "desc" }, { startDate: "asc" }],
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
      <div className="sticky top-[74px] space-y-4">
        {/* ① 광고 */}
        {ads.length > 0 && <SidebarAd ads={ads} />}

        {/* ② 티켓 할인 */}
        {tickets.length > 0 && (
          <Widget title="🎟 추천 티켓">
            <ul className="space-y-3">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/culture-events/${t.slug}`}
                    className="group flex gap-3"
                  >
                    {t.thumbnailUrl && (
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                        <img
                          src={t.thumbnailUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-medium leading-snug text-ink group-hover:text-gold-deep">
                        {t.title}
                      </p>
                      <p className="mt-0.5 font-label text-[11px] text-taupe">
                        {formatKSTDate(t.startDate)}
                      </p>
                      {t.memberDiscount > 0 &&
                        (isMember ? (
                          <span className="mt-0.5 inline-block font-label text-[10px] font-bold text-terra">
                            회원 {t.memberDiscount}% 할인
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-block font-label text-[10px] text-ink/40">
                            로그인 시 할인가
                          </span>
                        ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <WidgetMore href="/tickets" label="전체 티켓 할인 보기" />
          </Widget>
        )}

        {/* ③ StageOS (B 서브브랜드) */}
        <Link
          href="/stageos"
          className="block rounded-[9px] border border-os-purple/20 bg-[linear-gradient(135deg,#0a0f1a,#111827)] p-4 transition-opacity hover:opacity-95"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-os-purple" />
            <span className="font-label text-[9px] uppercase tracking-[0.2em] text-os-purple-light/60">
              Coming Soon · StageOS
            </span>
          </div>
          <p className="mt-2 font-headline text-base font-black tracking-tight text-white">
            Stage<span className="text-os-purple">OS</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            공연·전시·축제 주최사를 위한 AI 운영 플랫폼. 정보 한 번 입력으로 모든 것을 자동화.
          </p>
          <ul className="mt-2.5 space-y-1 text-[11px] text-white/55">
            {[
              "모바일 브로셔 자동 생성",
              "다국어 음성 해설",
              "관객 데이터 분석",
              "AI 마에스트로 API",
            ].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span className="text-os-purple">·</span>
                {f}
              </li>
            ))}
          </ul>
          <span className="mt-3 block w-full rounded-md bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] py-2 text-center font-label text-[10px] font-bold uppercase tracking-wider text-white">
            얼리 액세스 신청 →
          </span>
        </Link>

        {/* ④ 최근 기사 (홈에선 본문 "최신 기사"와 중복 → 숨김) */}
        {!hideRecent && recentArticles.length > 0 && (
          <Widget title="최근 기사">
            <ul className="space-y-2">
              {recentArticles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/articles/${a.slug}`}
                    className="flex gap-1.5 text-xs leading-snug text-slate hover:text-gold-deep"
                  >
                    <span className="text-gold">·</span>
                    <span className="line-clamp-2">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Widget>
        )}

        {/* ⑤ 뉴스레터 (STAGE Weekly) */}
        <div className="rounded-[9px] border border-ink/[0.08] bg-widget-bg p-4">
          <p className="font-headline text-[15px] italic text-ink">
            STAGE Weekly
          </p>
          <p className="mb-3 mt-1 text-[11px] leading-relaxed text-taupe">
            매주 토요일 아침, 문화예술 이야기를 편지함으로.
          </p>
          <NewsletterForm source="sidebar" placeholder="이메일 주소" />
        </div>
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
    <div className="rounded-[9px] border border-ink/[0.08] bg-widget-bg p-4">
      <h3 className="mb-3 font-label text-[10px] font-bold uppercase tracking-[0.2em] text-gold-deep">
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
      className="mt-3 block border-t border-ink/[0.08] pt-2 font-label text-[10px] uppercase tracking-wider text-ink/40 hover:text-gold-deep"
    >
      {label} →
    </Link>
  );
}

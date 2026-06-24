import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ProfileForm } from "@/components/public/profile-form";
import { ArticleCard } from "@/components/public/article-card";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/actions/auth-actions";
import { formatKSTDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "마이페이지 | STAGE" };

const TIER_LABEL: Record<string, string> = {
  guest: "게스트",
  member: "멤버",
  pro: "프로",
};
const TIER_CLASS: Record<string, string> = {
  guest: "bg-surface-warm text-taupe",
  member: "bg-ink text-white",
  pro: "bg-gold-deep text-white",
};
// AI 마에스트로 일일 한도(라우트와 동일 정책)
const AI_DAILY_LIMIT: Record<string, number> = {
  guest: 5,
  member: 30,
  pro: Infinity,
};

// 마이페이지 섹션 헤더 (모노 키커 + 세리프 제목)
function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="border-b-2 border-ink pb-2.5">
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-gold-deep">
        {kicker}
      </span>
      <h2 className="font-headline mt-1 text-2xl font-bold tracking-tight text-ink">
        {title}
      </h2>
    </div>
  );
}

const NAV = [
  { id: "membership", label: "멤버십" },
  { id: "library", label: "내 서재" },
  { id: "maestro", label: "마에스트로" },
  { id: "settings", label: "설정" },
  { id: "account", label: "계정" },
];

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const [bookmarks, recentAi, aiTodayRows, aiTotal] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        article: {
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            author: true,
            category: true,
            genre: true,
            subCategory: true,
            publishedAt: true,
            thumbnailUrl: true,
            thumbnailFocusX: true,
            thumbnailFocusY: true,
            thumbnailZoom: true,
            isPremium: true,
          },
        },
      },
    }),
    prisma.aiInteraction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, question: true, createdAt: true, sourceCount: true },
    }),
    // 오늘(24h) 사용량 — DB now()로 시간 계산(서버 컴포넌트 렌더 순수성 유지)
    prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "AiInteraction"
       WHERE "userId" = $1 AND "createdAt" >= now() - interval '24 hours'`,
      user.id,
    ),
    prisma.aiInteraction.count({ where: { userId: user.id } }),
  ]);

  const aiToday = aiTodayRows[0]?.n ?? 0;
  const tier = user.tier;
  const limit = AI_DAILY_LIMIT[tier] ?? AI_DAILY_LIMIT.member;
  const initial = (user.name || user.email || "S").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* ── 개요 헤더 ── */}
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name || "프로필"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink font-headline text-2xl text-white">
                {initial}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline text-2xl font-bold tracking-tight text-ink">
                  {user.name || "STAGE 회원"}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider ${TIER_CLASS[tier] ?? TIER_CLASS.member}`}
                >
                  {TIER_LABEL[tier] ?? "멤버"}
                </span>
              </div>
              <p className="mt-1 text-sm text-taupe">{user.email}</p>
            </div>
          </div>

          {/* 퀵 통계 */}
          <div className="flex gap-6 sm:ml-auto">
            {[
              { n: bookmarks.length, label: "북마크" },
              { n: aiTotal, label: "마에스트로" },
              { n: user.interests.length, label: "관심 장르" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-headline text-2xl font-bold text-ink">
                  {s.n}
                </div>
                <div className="font-label text-[10px] uppercase tracking-wider text-taupe">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 인페이지 내비 ── */}
        <nav className="mt-8 flex gap-5 overflow-x-auto border-y border-ink/10 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="whitespace-nowrap font-label text-xs uppercase tracking-wider text-ink/55 transition-colors hover:text-gold-deep"
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* ── 멤버십 ── */}
        <section id="membership" className="mt-14 scroll-mt-20">
          <SectionHead kicker="Membership" title="멤버십" />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-gold-deep/20 bg-surface-warm p-6">
            <div>
              <p className="font-headline text-lg text-ink">
                {tier === "pro" ? "STAGE Pro 멤버" : "STAGE 멤버"}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {tier === "pro"
                  ? user.proExpiresAt
                    ? `프로 멤버십 만료 · ${formatKSTDate(user.proExpiresAt)}`
                    : "프로 혜택 이용 중"
                  : "프리미엄 기사·무제한 마에스트로 등 Pro 혜택을 만나보세요."}
              </p>
            </div>
            {tier !== "pro" && (
              <Link
                href="/membership"
                className="bg-gold-deep px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-ink"
              >
                STAGE Pro 업그레이드
              </Link>
            )}
          </div>
        </section>

        {/* ── 내 서재 (북마크) ── */}
        <section id="library" className="mt-14 scroll-mt-20">
          <SectionHead kicker="Library" title="내 서재" />
          {bookmarks.length === 0 ? (
            <p className="mt-6 text-sm text-taupe">
              아직 북마크한 기사가 없습니다.{" "}
              <Link href="/articles" className="text-gold-deep hover:underline">
                기사 둘러보기 →
              </Link>
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {bookmarks.map((b) => (
                <ArticleCard key={b.article.id} article={b.article} />
              ))}
            </div>
          )}
        </section>

        {/* ── 마에스트로 활동 ── */}
        <section id="maestro" className="mt-14 scroll-mt-20">
          <SectionHead kicker="AI Maestro" title="마에스트로 활동" />
          <div className="mt-6 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            <span>오늘 사용</span>
            <span className="font-label font-bold text-teal-deep">
              {aiToday}
              {limit === Infinity ? "" : ` / ${limit}`}
            </span>
            <span className="text-taupe">
              {limit === Infinity ? "(무제한)" : "회"}
            </span>
            <Link
              href="/ai-maestro"
              className="ml-auto font-label text-xs uppercase tracking-wider text-teal-deep hover:underline"
            >
              마에스트로 열기 →
            </Link>
          </div>
          {recentAi.length === 0 ? (
            <p className="mt-4 text-sm text-taupe">
              아직 마에스트로에게 물어본 기록이 없습니다.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
              {recentAi.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="line-clamp-1 flex-1 text-sm text-ink">
                    “{a.question}”
                  </span>
                  {a.sourceCount > 0 && (
                    <span className="font-label text-[10px] uppercase tracking-wider text-taupe">
                      출처 {a.sourceCount}
                    </span>
                  )}
                  <span className="font-label text-[10px] tracking-wide text-date">
                    {formatKSTDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── 설정 ── */}
        <section id="settings" className="mt-14 scroll-mt-20">
          <SectionHead kicker="Settings" title="설정" />
          <div className="mt-6">
            <ProfileForm
              name={user.name}
              interests={user.interests}
              newsletterOptIn={user.newsletterOptIn}
              eventAlertOptIn={user.eventAlertOptIn}
            />
          </div>
        </section>

        {/* ── 계정 ── */}
        <section id="account" className="mt-14 scroll-mt-20">
          <SectionHead kicker="Account" title="계정" />
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-b border-ink/10 pb-3">
              <dt className="text-taupe">이메일</dt>
              <dd className="text-ink">{user.email}</dd>
            </div>
            <div className="flex justify-between border-b border-ink/10 pb-3">
              <dt className="text-taupe">로그인 방식</dt>
              <dd className="text-ink">{user.snsProvider || "이메일"}</dd>
            </div>
            <div className="flex justify-between pb-3">
              <dt className="text-taupe">가입일</dt>
              <dd className="font-label tracking-wide text-date">
                {formatKSTDate(user.createdAt)}
              </dd>
            </div>
          </dl>
          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="border border-ink/20 px-6 py-2.5 font-label text-[11px] font-bold uppercase tracking-widest text-ink-muted transition-colors hover:border-terra hover:text-terra"
            >
              로그아웃
            </button>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
}

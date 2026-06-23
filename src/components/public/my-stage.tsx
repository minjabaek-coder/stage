import Link from "next/link";
import type { UserTier } from "@/generated/prisma/client";

const TIER: Record<UserTier, { label: string; cls: string }> = {
  guest: { label: "GUEST", cls: "bg-ink/10 text-taupe" },
  member: { label: "MEMBER", cls: "bg-teal text-white" },
  pro: { label: "PRO", cls: "bg-gold text-white" },
};

// 좌측 레일 My STAGE (page-home §A-1): 로그인 회원 라운지.
// 비로그인 시 렌더하지 않음(LeftRail에서 제어).
export function MyStage({
  name,
  tier,
  bookmarkCount,
  aiUsed,
  aiLimit,
  interests,
}: {
  name: string;
  tier: UserTier;
  bookmarkCount: number;
  aiUsed: number;
  aiLimit: number;
  interests: string[];
}) {
  const t = TIER[tier] ?? TIER.guest;
  return (
    <div className="rounded-lg border border-ink/[0.06] bg-paper p-3.5">
      <div className="mb-2 font-label text-[8px] uppercase tracking-[3px] text-ink/30">
        My STAGE
      </div>
      <span
        className={`inline-block rounded-full px-2 py-0.5 font-label text-[9px] font-bold tracking-wider ${t.cls}`}
      >
        {t.label}
      </span>
      <div className="mt-2 text-[13px] font-bold text-ink">
        {name || "회원"} 님
      </div>

      <div className="my-3 h-px bg-ink/[0.08]" />

      <div className="flex items-center justify-between border-b border-ink/[0.05] py-1.5 text-[12px] text-ink/70">
        <span>내 북마크</span>
        <span className="font-label font-medium text-gold-deep">
          {bookmarkCount}
        </span>
      </div>
      <div className="flex items-center justify-between py-1.5 text-[12px] text-ink/70">
        <span>오늘 AI 질문</span>
        <span className="font-label font-medium text-gold-deep">
          {Number.isFinite(aiLimit) ? `${aiUsed} / ${aiLimit}` : `${aiUsed}`}
        </span>
      </div>

      {interests.length > 0 && (
        <div className="mt-2">
          <div className="mb-1.5 font-label text-[8px] uppercase tracking-[3px] text-ink/30">
            관심 장르
          </div>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((g) => (
              <span
                key={g}
                className="rounded-[3px] bg-gold/[0.13] px-2 py-0.5 text-[10px] text-gold-text"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/mypage"
        className="mt-3 block rounded-md border border-ink/20 py-2 text-center text-[11px] font-bold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
      >
        마이페이지
      </Link>
    </div>
  );
}

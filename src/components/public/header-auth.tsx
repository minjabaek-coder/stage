"use client";

import Link from "next/link";
import { useUser, type CurrentUser } from "@/hooks/use-user";
import { signOut } from "@/actions/auth-actions";

const TIER_LABEL: Record<CurrentUser["tier"], string> = {
  guest: "게스트",
  member: "멤버",
  pro: "프로",
};

const TIER_CLASS: Record<CurrentUser["tier"], string> = {
  guest: "bg-gray-100 text-gray-500",
  member: "bg-[#1c1b1b] text-white",
  pro: "bg-[#6f5c24] text-white",
};

function TierBadge({ tier }: { tier: CurrentUser["tier"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TIER_CLASS[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

type Variant = "editorial" | "default";

// 헤더 회원 영역. 홈(서버 컴포넌트)의 에디토리얼 헤더와 SiteHeader 양쪽에서 사용.
export function HeaderAuth({
  variant = "default",
  mobile = false,
}: {
  variant?: Variant;
  mobile?: boolean;
}) {
  const { user, isLoading } = useUser();
  if (isLoading) return null;

  const editorial = variant === "editorial";

  // ── 모바일(세로 스택, SiteHeader 드롭다운 전용) ──────────────────────────
  if (mobile) {
    if (user) {
      return (
        <div className="border-t border-gray-100">
          <Link
            href="/mypage"
            className="flex items-center gap-2 px-6 py-3 hover:bg-gray-50"
          >
            <TierBadge tier={user.tier} />
            <span className="max-w-[200px] truncate text-sm text-gray-700">
              {user.name || user.email}
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full px-6 py-3 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              로그아웃
            </button>
          </form>
        </div>
      );
    }
    return (
      <div className="border-t border-gray-100">
        <Link
          href="/auth/login"
          className="block px-6 py-3 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          로그인
        </Link>
        <Link
          href="/auth/signup"
          className="block px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          회원가입
        </Link>
      </div>
    );
  }

  // ── 데스크톱(가로) ────────────────────────────────────────────────────────
  if (user) {
    return (
      <div
        className={`flex items-center gap-2 ${
          editorial ? "" : "border-l border-gray-200 pl-4"
        }`}
      >
        <Link href="/mypage" className="flex items-center gap-2">
          <TierBadge tier={user.tier} />
          <span
            className={`max-w-[140px] truncate ${
              editorial
                ? "font-label text-xs font-semibold uppercase tracking-[0.05em] opacity-70 transition-colors hover:text-[#6f5c24]"
                : "text-sm text-gray-700 hover:text-gray-900"
            }`}
          >
            {user.name || user.email}
          </span>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className={
              editorial
                ? "font-label text-xs font-semibold uppercase tracking-[0.05em] opacity-50 transition-colors duration-300 hover:text-[#6f5c24] hover:opacity-100"
                : "text-sm text-gray-400 transition-colors hover:text-gray-900"
            }
          >
            로그아웃
          </button>
        </form>
      </div>
    );
  }

  if (editorial) {
    return (
      <div className="flex items-center gap-5">
        <Link
          href="/auth/login"
          className="font-label text-xs font-semibold uppercase tracking-[0.05em] opacity-70 transition-colors duration-300 hover:text-[#6f5c24]"
        >
          로그인
        </Link>
        <Link
          href="/auth/signup"
          className="bg-[#1c1b1b] px-4 py-2 font-label text-xs font-semibold uppercase tracking-[0.05em] text-[#fcf9f8] transition-colors duration-300 hover:bg-[#6f5c24]"
        >
          회원가입
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
      <Link
        href="/auth/login"
        className="text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        로그인
      </Link>
      <Link
        href="/auth/signup"
        className="rounded-full bg-[#1c1b1b] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#6f5c24]"
      >
        회원가입
      </Link>
    </div>
  );
}

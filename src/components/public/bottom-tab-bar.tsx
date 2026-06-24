"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/use-user";

// 모바일 하단 탭바 (v2 global-chrome §6). ≤md에서만 노출.
// 5탭: 홈·매거진·🎟티켓·🎼AI·My(계정). 나머지(기사·소개·문의)는 헤더 햄버거 메뉴.
// My: 로그인 시 마이페이지, 비로그인 시 로그인으로.
type Tab = {
  href: string;
  label: string;
  icon: string;
  accent?: "terra" | "teal";
};
const TABS: Tab[] = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/magazines", label: "매거진", icon: "📖" },
  { href: "/tickets", label: "티켓", icon: "🎟", accent: "terra" },
  { href: "/ai-maestro", label: "AI", icon: "🎼", accent: "teal" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function tabColor(active: boolean, accent?: "terra" | "teal") {
  if (!active) return "text-ink/45";
  if (accent === "terra") return "text-terra";
  if (accent === "teal") return "text-teal";
  return "text-gold-deep";
}

const TAB_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors";

export function BottomTabBar() {
  const pathname = usePathname();
  const { user } = useUser();

  const myHref = user ? "/mypage" : "/auth/login";
  const myActive =
    pathname.startsWith("/mypage") || pathname.startsWith("/auth");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[100] flex border-t border-ink/10 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[14px] md:hidden">
      {TABS.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`${TAB_CLASS} ${tabColor(active, t.accent)}`}
          >
            <span className="text-base leading-none" aria-hidden>
              {t.icon}
            </span>
            <span className="font-body">{t.label}</span>
          </Link>
        );
      })}
      <Link
        href={myHref}
        aria-current={myActive ? "page" : undefined}
        className={`${TAB_CLASS} ${myActive ? "text-gold-deep" : "text-ink/45"}`}
      >
        <span className="text-base leading-none" aria-hidden>
          👤
        </span>
        <span className="font-body">My</span>
      </Link>
    </nav>
  );
}

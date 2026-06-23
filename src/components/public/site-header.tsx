"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderAuth } from "@/components/public/header-auth";
import { StageOsBanner } from "@/components/public/stageos-banner";

// v2 GNB (2026-06-23): 홈·매거진·기사·티켓·소개·문의.
// 티켓은 테라코타 특수색(이모지 없음). AI 마에스트로=FAB/홈/푸터, 블로그·공연전시=제외.
type NavItem = { href: string; label: string; accent?: "terra" };
const navItems: NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/magazines", label: "매거진" },
  { href: "/articles", label: "기사" },
  { href: "/tickets", label: "티켓", accent: "terra" },
  { href: "/about", label: "소개" },
  { href: "/contact", label: "문의" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* StageOS 배너 (유틸리티 바는 제거됨 — 2026-06-23 결정) */}
      <StageOsBanner />

      {/* 에디토리얼 헤더 */}
      <header className="sticky top-0 z-[100] border-b border-ink/10 bg-paper/95 shadow-[0_2px_20px_rgba(0,0,0,0.05)] backdrop-blur-[14px]">
        <div className="mx-auto flex h-[58px] max-w-[1380px] items-center justify-between gap-4 px-3 sm:px-8">
          <Link
            href="/"
            className="flex-shrink-0 font-headline text-[22px] font-black tracking-[-0.04em] text-ink sm:text-[26px]"
          >
            STAGE
          </Link>

          {/* Desktop GNB */}
          <nav className="hidden items-center md:flex">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const terra = item.accent === "terra";
              const base =
                "flex h-[58px] items-center whitespace-nowrap border-b-2 px-3 font-body text-[13px] font-semibold tracking-[0.01em] transition-colors";
              const tone = terra
                ? active
                  ? "border-terra text-terra"
                  : "border-transparent text-terra/80 hover:border-terra hover:text-terra"
                : active
                  ? "border-gold text-ink"
                  : "border-transparent text-ink/50 hover:border-gold hover:text-ink";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${base} ${tone}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: 인증(항상 노출) + 모바일 햄버거(메뉴만) */}
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <HeaderAuth variant="editorial" />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center text-lg text-ink/70 hover:text-ink md:hidden"
              aria-label="메뉴"
              aria-expanded={menuOpen}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* 모바일 메뉴(내비게이션만 — 인증은 헤더에 분리 노출). 하단 탭바는 후속 청크 */}
        {menuOpen && (
          <nav className="border-t border-ink/10 bg-paper md:hidden">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`block px-6 py-3 font-body text-sm transition-colors hover:bg-gold/[0.06] ${
                    active
                      ? "font-semibold text-gold-deep"
                      : item.accent === "terra"
                        ? "text-terra"
                        : "text-ink/70"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
    </>
  );
}

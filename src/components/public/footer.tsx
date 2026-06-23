import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollToTopButton } from "./scroll-to-top-button";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block py-1 font-body text-[13px] text-white/45 transition-colors hover:text-gold"
    >
      {children}
    </Link>
  );
}

function FooterExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block py-1 font-body text-[13px] text-white/45 transition-colors hover:text-gold"
    >
      {children}
    </a>
  );
}

function FooterColHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
      {children}
    </h3>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink pb-[max(env(safe-area-inset-bottom),56px)] text-white/55 md:pb-0">
      {/* 모바일 하단 탭바(고정)에 가리지 않도록 하단 여백 */}
      <div className="mx-auto max-w-[1380px] px-3 sm:px-8">
        {/* Top: logo + scroll-to-top */}
        <div className="flex items-center justify-between border-b border-white/10 py-8">
          <Link
            href="/"
            className="font-headline text-xl font-black tracking-[-0.03em] text-white"
          >
            STAGE
          </Link>
          <ScrollToTopButton />
        </div>

        {/* 4-column (mobile 2-column; brand spans full width) */}
        <div className="grid grid-cols-2 gap-10 py-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand + company info */}
          <div className="col-span-2 space-y-4 text-[13px] leading-relaxed lg:col-span-1">
            <p className="text-white/70">문화예술 AI 매거진</p>
            <div className="space-y-1.5 text-white/40">
              <div>서울특별시 관악구 남부순환로 266길 21 B1</div>
              <div>
                <a
                  href="mailto:voceverdiana@naver.com"
                  className="transition-colors hover:text-gold"
                >
                  voceverdiana@naver.com
                </a>{" "}
                ·{" "}
                <a
                  href="tel:010-5235-8025"
                  className="transition-colors hover:text-gold"
                >
                  010-5235-8025
                </a>
              </div>
              <div className="text-white/30">
                대표발행인 박경준 · 발행기획 아트컴퍼니본 · AI 기술 (주)카이로스팀
              </div>
              <div className="text-white/25">사업자등록번호 116-81-95607</div>
            </div>
          </div>

          {/* 매거진 */}
          <div>
            <FooterColHeading>매거진</FooterColHeading>
            <FooterLink href="/magazines">매거진 목록</FooterLink>
            <FooterLink href="/articles">기사</FooterLink>
            <FooterLink href="/blog">블로그</FooterLink>
          </div>

          {/* 공연·티켓 */}
          <div>
            <FooterColHeading>공연·티켓</FooterColHeading>
            <FooterLink href="/culture-events">공연·전시·교육</FooterLink>
            <FooterLink href="/tickets">회원 티켓 할인</FooterLink>
            <FooterLink href="/ai-maestro">AI 마에스트로</FooterLink>
          </div>

          {/* 정보 */}
          <div>
            <FooterColHeading>정보</FooterColHeading>
            <FooterLink href="/about">STAGE 소개</FooterLink>
            <FooterLink href="/membership">STAGE Pro</FooterLink>
            <FooterLink href="/advertise">광고 안내</FooterLink>
            <FooterLink href="/tip">기사 제보</FooterLink>
            <FooterLink href="/contact">문의</FooterLink>
            <FooterLink href="/stageos">StageOS</FooterLink>
            <FooterExtLink href="https://kairossebook.com">
              Kairossebook ↗
            </FooterExtLink>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6">
          <p className="font-label text-[11px] tracking-wide text-white/30">
            © 2026 STAGE. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-4 text-[12px] text-white/30">
            <span className="cursor-pointer transition-colors hover:text-white/60">
              이용약관
            </span>
            <span className="cursor-pointer transition-colors hover:text-white/60">
              개인정보처리방침
            </span>
            <span className="cursor-pointer transition-colors hover:text-white/60">
              저작권
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

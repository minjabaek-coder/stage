import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollToTopButton } from "./scroll-to-top-button";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block py-1 text-sm text-gray-400 transition-colors hover:text-white"
    >
      {children}
    </Link>
  );
}

// 아직 구현되지 않은 페이지는 죽은 링크 대신 '준비중' 표기 (페이지 생기면 링크로 교체)
function FooterSoon({ children }: { children: ReactNode }) {
  return (
    <span className="block py-1 text-sm text-gray-600">
      {children} <span className="text-[10px] align-middle">(준비중)</span>
    </span>
  );
}

function FooterColHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 font-label text-[11px] font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </h3>
  );
}

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="mx-auto max-w-7xl px-6">
        {/* Top: logo + scroll-to-top */}
        <div className="flex items-center justify-between border-b border-white/10 py-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            STAGE
          </Link>
          <ScrollToTopButton />
        </div>

        {/* 4-column (mobile 2-column; brand spans full width) */}
        <div className="grid grid-cols-2 gap-10 py-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand + company info */}
          <div className="col-span-2 space-y-4 text-sm leading-relaxed lg:col-span-1">
            <p className="text-gray-300">문화예술 AI 매거진</p>
            <div className="space-y-1.5">
              <div>서울특별시 관악구 남부순환로 266길 21 B1</div>
              <div>
                <a
                  href="mailto:voceverdiana@naver.com"
                  className="transition-colors hover:text-white"
                >
                  voceverdiana@naver.com
                </a>{" "}
                ·{" "}
                <a
                  href="tel:010-5235-8025"
                  className="transition-colors hover:text-white"
                >
                  010-5235-8025
                </a>
              </div>
              <div className="text-gray-500">
                대표발행인 박경준 · 발행기획 아트컴퍼니본 · AI 기술 (주)카이로스
              </div>
              <div className="text-gray-600">사업자등록번호 116-81-95607</div>
            </div>
          </div>

          {/* 매거진 */}
          <div>
            <FooterColHeading>매거진</FooterColHeading>
            <FooterLink href="/magazines">매거진 목록</FooterLink>
            <FooterLink href="/articles">기사</FooterLink>
            <FooterLink href="/blog">블로그</FooterLink>
          </div>

          {/* 문화예술 */}
          <div>
            <FooterColHeading>문화예술</FooterColHeading>
            <FooterLink href="/culture-events">공연·전시·교육</FooterLink>
            <FooterLink href="/tickets">회원 티켓 할인</FooterLink>
            <FooterSoon>AI 마에스트로</FooterSoon>
          </div>

          {/* 정보 */}
          <div>
            <FooterColHeading>정보</FooterColHeading>
            <FooterLink href="/about">STAGE 소개</FooterLink>
            <FooterSoon>광고 안내</FooterSoon>
            <FooterLink href="/tip">기사 제보</FooterLink>
            <FooterLink href="/contact">문의</FooterLink>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6">
          <p className="text-xs text-gray-600">
            Copyright &copy; 2026 스테이지. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-gray-600">
            <span>이용약관</span>
            <span>개인정보처리방침</span>
            <span>저작권</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

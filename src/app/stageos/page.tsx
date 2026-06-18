import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";

export const metadata: Metadata = {
  title: "StageOS — 문화·이벤트를 위한 AI 경험 OS | STAGE",
  description:
    "공연·전시·축제 정보를 한 번 입력하면 AI가 모바일 브로셔·작품 해설·다국어 음성 가이드·QR 배포·관객 분석까지 자동 생성하는 멀티테넌트 클라우드 SaaS.",
};

const FEATURES = [
  {
    title: "한 번 입력, 자동 생성",
    desc: "행사·작품 정보를 한 번 입력하면 모바일 브로셔·작품 해설·소개 페이지를 AI가 자동으로 만들어 드립니다.",
  },
  {
    title: "다국어 음성 가이드",
    desc: "AI가 작품 해설을 다국어 텍스트·음성 가이드로 변환해 해외 관객까지 아우릅니다.",
  },
  {
    title: "QR 배포 · 관객 PWA",
    desc: "설치 없는 관객용 PWA를 QR로 배포. 현장에서 바로 브로셔와 해설을 만날 수 있습니다.",
  },
  {
    title: "관객 분석",
    desc: "조회·체류·관심 데이터를 모아 다음 기획에 활용할 인사이트를 제공합니다.",
  },
];

const SURFACES = [
  { label: "관객", desc: "QR로 여는 모바일 경험(PWA)" },
  { label: "운영자", desc: "테넌트별 콘텐츠·배포 관리 콘솔" },
  { label: "구독·분석", desc: "요금제·관객 분석·운영 대시보드" },
];

const SHOTS = [
  { src: "/stageos/event-page.png", alt: "관객용 이벤트 페이지" },
  { src: "/stageos/content-panel.png", alt: "운영자 콘텐츠 패널" },
  { src: "/stageos/ops-dashboard.png", alt: "운영 대시보드" },
];

export default function StageOSPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.3em] text-[#6f5c24]">
            StageOS · AI Experience OS for Culture &amp; Events
          </span>
          <h1 className="font-headline mt-6 text-4xl leading-[1.1] tracking-tight md:text-6xl">
            문화·이벤트를 위한
            <br />
            AI 경험 OS
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#444748]">
            공연·전시·영화제·축제 정보를 <strong>한 번 입력</strong>하면, AI가
            모바일 브로셔·작품 해설·다국어 음성 가이드·QR 배포·관객 분석까지
            자동으로 만들어 드립니다. 주최사를 위한 멀티테넌트 클라우드 SaaS.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-block bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
            >
              도입·데모 문의
            </Link>
          </div>
          <p className="mt-4 font-label text-[10px] uppercase tracking-wider opacity-40">
            주식회사 카이로스팀 · BIPA 2026 클라우드 SaaS 지원사업
          </p>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid gap-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[#1c1b1b]/10 bg-white p-8"
              >
                <h3 className="font-headline text-2xl">{f.title}</h3>
                <p className="mt-3 leading-relaxed text-[#444748]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Surfaces */}
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="font-label text-sm font-black uppercase tracking-[0.2em] text-[#6f5c24]">
            하나의 OS, 세 개의 화면
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {SURFACES.map((s) => (
              <div key={s.label} className="border-t border-[#1c1b1b]/10 pt-4">
                <p className="font-headline text-xl">{s.label}</p>
                <p className="mt-1 text-sm text-[#444748]">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Screenshots */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-6 md:grid-cols-3">
            {SHOTS.map((s) => (
              <div
                key={s.src}
                className="overflow-hidden rounded-xl border border-[#1c1b1b]/10 bg-white"
              >
                <img
                  src={s.src}
                  alt={s.alt}
                  className="w-full object-cover"
                />
                <p className="px-4 py-3 font-label text-[11px] uppercase tracking-wider text-[#444748]">
                  {s.alt}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-10 text-center">
            <p className="font-headline text-3xl">StageOS 도입을 검토 중이신가요?</p>
            <p className="mt-3 text-[#444748]">
              기관·주최사 맞춤 데모와 도입 상담을 도와드립니다.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-block bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
            >
              도입·데모 문의하기
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

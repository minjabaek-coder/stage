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

// 도입·데모 문의 링크. stage-os에 문의 페이지가 생기면 외부 URL로 교체.
// (현재 stage-os 공개 앱엔 문의 라우트 없음 → STAGE 통합 문의로 연결, "StageOS 도입" 유형 존재)
const DEMO_INQUIRY_HREF = "/contact";

const OS_GRADIENT = "bg-[linear-gradient(135deg,#6366f1,#8b5cf6)]";

export default function StageOSPage() {
  return (
    <div className="min-h-screen bg-[#0b1120] text-white">
      <SiteHeader />

      <main>
        {/* Hero — 미드나잇 그라데이션 + 퍼플 글로우 (B 서브브랜드) */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#0a0f1a_0%,#111827_50%,#0d1520_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(99,102,241,0.20)_0%,transparent_60%)]" />
          <div className="relative z-[1] mx-auto max-w-5xl px-6 py-24 text-center">
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.3em] text-os-purple-light">
              StageOS · AI Experience OS for Culture &amp; Events
            </span>
            <h1 className="font-headline mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
              문화·이벤트를 위한
              <br />
              AI 경험 OS
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
              공연·전시·영화제·축제 정보를{" "}
              <strong className="text-white">한 번 입력</strong>하면, AI가 모바일
              브로셔·작품 해설·다국어 음성 가이드·QR 배포·관객 분석까지 자동으로
              만들어 드립니다. 주최사를 위한 멀티테넌트 클라우드 SaaS.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href={DEMO_INQUIRY_HREF}
                className={`inline-block ${OS_GRADIENT} px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90`}
              >
                도입·데모 문의
              </Link>
            </div>
            <p className="mt-4 font-label text-[10px] uppercase tracking-wider text-white/40">
              주식회사 카이로스팀
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-8"
              >
                <h3 className="font-headline text-2xl text-white">{f.title}</h3>
                <p className="mt-3 leading-relaxed text-white/65">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Surfaces */}
        <section className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="font-label text-sm font-black uppercase tracking-[0.2em] text-os-purple-light">
            하나의 OS, 세 개의 화면
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {SURFACES.map((s) => (
              <div key={s.label} className="border-t border-os-purple/30 pt-4">
                <p className="font-headline text-xl text-white">{s.label}</p>
                <p className="mt-1 text-sm text-white/60">{s.desc}</p>
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
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={s.alt} className="w-full object-cover" />
                <p className="px-4 py-3 font-label text-[11px] uppercase tracking-wider text-white/55">
                  {s.alt}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="relative overflow-hidden rounded-2xl border border-os-purple/30 bg-os-purple/10 p-10 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.18)_0%,transparent_60%)]" />
            <div className="relative z-[1]">
              <p className="font-headline text-3xl text-white">
                StageOS 도입을 검토 중이신가요?
              </p>
              <p className="mt-3 text-white/65">
                기관·주최사 맞춤 데모와 도입 상담을 도와드립니다.
              </p>
              <Link
                href={DEMO_INQUIRY_HREF}
                className={`mt-6 inline-block ${OS_GRADIENT} px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90`}
              >
                도입·데모 문의하기
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

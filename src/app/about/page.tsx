import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "STAGE 소개 | STAGE",
  description:
    "STAGE는 읽고 · 묻고 · 더 듣는 문화예술 AI 매거진입니다. 창간 배경, AI 마에스트로, 팀을 소개합니다.",
};

const DIFFERENCES: { label: string; auditorium: string; stage: string }[] = [
  { label: "콘텐츠 형식", auditorium: "인쇄 → JPG 스캔", stage: "구조화 텍스트 + 인터랙티브" },
  { label: "검색", auditorium: "연·월 단순 목록", stage: "AI 자연어 검색" },
  { label: "독자 참여", auditorium: "없음", stage: "AI 마에스트로 Q&A" },
  { label: "수익 모델", auditorium: "인쇄 구독 + 지면 광고", stage: "멤버십 + 네이티브 광고 + 티켓 + 교육" },
  { label: "데이터", auditorium: "비정형", stage: "정규화 → StageOS 자산" },
];

const JOURNEY = [
  { step: "읽고", desc: "에디토리얼 매거진과 기사를 깊이 있게 읽습니다." },
  { step: "묻고", desc: "읽다가 궁금한 점을 AI 마에스트로에게 바로 물어봅니다." },
  { step: "더 듣다", desc: "관련 공연·아티스트·작품으로 경험을 확장합니다." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        {/* 1. STAGE 소개 */}
        <section>
          <span className="font-label text-xs font-semibold uppercase tracking-[0.25em] text-[#6f5c24]">
            About STAGE
          </span>
          <h1 className="font-headline mt-4 text-4xl leading-tight tracking-tight md:text-5xl">
            읽고 · 묻고 · 더 듣다
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[#444748]">
            STAGE는 공연예술을 중심으로 한 <strong>문화예술 AI 매거진</strong>입니다.
            인쇄 매거진의 깊이 있는 편집은 계승하되, 디지털·검색·AI로 독자 경험을
            새롭게 설계합니다. 발행기획은 아트컴퍼니본, AI 기술은 (주)카이로스가
            함께합니다.
          </p>
        </section>

        {/* 2. AI 마에스트로 */}
        <section className="mt-16 border-t border-[#1c1b1b]/10 pt-12">
          <h2 className="font-headline text-2xl md:text-3xl">AI 마에스트로란?</h2>
          <p className="mt-4 leading-relaxed text-[#444748]">
            STAGE의 콘텐츠를 학습한 AI가 독자의 질문에 답하는 도슨트입니다. 기사를
            읽다가 작곡가·작품·공연 정보가 궁금하면 바로 물어볼 수 있습니다.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {JOURNEY.map((j, i) => (
              <div key={j.step} className="rounded-lg bg-white p-5 shadow-sm">
                <span className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
                  Step {i + 1}
                </span>
                <div className="font-headline mt-1 text-xl">{j.step}</div>
                <p className="mt-2 text-sm leading-relaxed text-[#444748]">
                  {j.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. 월간객석과의 차이 */}
        <section className="mt-16 border-t border-[#1c1b1b]/10 pt-12">
          <h2 className="font-headline text-2xl md:text-3xl">기존 매거진과의 차이</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1c1b1b]/15 text-left">
                  <th className="py-3 pr-4 font-label text-[11px] uppercase tracking-wider text-[#444748]">
                    항목
                  </th>
                  <th className="py-3 pr-4 font-label text-[11px] uppercase tracking-wider text-[#444748]">
                    기존 인쇄 매거진
                  </th>
                  <th className="py-3 font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
                    STAGE
                  </th>
                </tr>
              </thead>
              <tbody>
                {DIFFERENCES.map((d) => (
                  <tr key={d.label} className="border-b border-[#1c1b1b]/10">
                    <td className="py-3 pr-4 font-semibold">{d.label}</td>
                    <td className="py-3 pr-4 text-[#444748]">{d.auditorium}</td>
                    <td className="py-3 text-[#1c1b1b]">{d.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. 팀 */}
        <section className="mt-16 border-t border-[#1c1b1b]/10 pt-12">
          <h2 className="font-headline text-2xl md:text-3xl">만드는 사람들</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <dt className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
                대표발행인
              </dt>
              <dd className="font-headline mt-1 text-xl">박경준</dd>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <dt className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
                발행기획
              </dt>
              <dd className="font-headline mt-1 text-xl">아트컴퍼니본</dd>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <dt className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
                AI 기술
              </dt>
              <dd className="font-headline mt-1 text-xl">(주) 카이로스</dd>
            </div>
            <div className="rounded-lg bg-white p-5 shadow-sm">
              <dt className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
                연혁
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-[#444748]">
                Vol.1 창간 → Vol.39부터 인터랙티브 eBook + AI 마에스트로 →
                StageOS 준비 중
              </dd>
            </div>
          </dl>
        </section>

        {/* CTA */}
        <section className="mt-16 border-t border-[#1c1b1b]/10 pt-12 text-center">
          <h2 className="font-headline text-2xl md:text-3xl">함께하기</h2>
          <p className="mt-3 text-[#444748]">
            제휴·광고·기고 문의를 환영합니다.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:voceverdiana@naver.com"
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#1c1b1b] px-5 text-sm font-medium text-white transition-colors hover:bg-[#6f5c24]"
            >
              이메일 문의
            </a>
            <Link
              href="/magazines"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#1c1b1b]/20 px-5 text-sm font-medium transition-colors hover:border-[#6f5c24] hover:text-[#6f5c24]"
            >
              매거진 보기
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

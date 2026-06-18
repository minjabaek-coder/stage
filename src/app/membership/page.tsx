import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { NewsletterForm } from "@/components/public/newsletter-form";

export const metadata: Metadata = {
  title: "STAGE Pro | STAGE",
  description: "프리미엄 기사·AI 마에스트로 무제한·티켓 할인을 누리는 STAGE Pro 멤버십. 곧 공개됩니다.",
};

const BENEFITS = [
  {
    title: "프리미엄 기사 전체 열람",
    desc: "회원 전용 심층 기사와 인터뷰를 제한 없이 읽을 수 있습니다.",
  },
  {
    title: "AI 마에스트로 무제한",
    desc: "질문 횟수 제한 없이 매거진·기사에 대해 마음껏 물어보세요.",
  },
  {
    title: "공연·전시 티켓 할인",
    desc: "STAGE가 안내하는 공연·전시·교육의 회원 할인을 받습니다.",
  },
  {
    title: "신규 호 우선 · 후원자 배지",
    desc: "새 매거진을 먼저 만나고, 프로필에 후원자 배지가 표시됩니다.",
  },
];

export default function MembershipPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.3em] text-[#6f5c24]">
            Membership
          </span>
          <h1 className="font-headline mt-6 text-5xl tracking-tight md:text-6xl">
            STAGE Pro
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#444748]">
            문화예술을 더 깊이, 더 가까이. 프리미엄 콘텐츠와 AI 마에스트로,
            티켓 혜택을 한 번에 누리는 STAGE Pro 멤버십을 준비하고 있습니다.
          </p>
        </div>

        {/* 혜택 */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-[#1c1b1b]/10 bg-white p-7"
            >
              <h3 className="font-headline text-2xl">{b.title}</h3>
              <p className="mt-2 leading-relaxed text-[#444748]">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* 가격(공개 예정) + 출시 알림 */}
        <div className="mt-12 rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-10 text-center">
          <span className="rounded-full bg-[#6f5c24] px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-white">
            공개 예정
          </span>
          <p className="mt-5 font-headline text-3xl">요금제 준비 중</p>
          <p className="mt-3 text-sm text-[#444748]">
            합리적인 월·연 구독 요금제를 준비하고 있습니다. 출시되면 가장 먼저
            알려드릴게요.
          </p>
          <div className="mx-auto mt-7 max-w-sm">
            <NewsletterForm
              source="pro-waitlist"
              submitLabel="출시 알림 신청"
              pendingLabel="신청 중..."
              successMessage="신청 완료! 출시되면 가장 먼저 알려드릴게요."
              placeholder="알림 받을 이메일"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

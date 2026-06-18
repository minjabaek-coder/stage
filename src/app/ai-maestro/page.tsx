import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ChatBody } from "@/components/public/docent-chat";

export const metadata: Metadata = {
  title: "AI 마에스트로 | STAGE",
  description:
    "STAGE가 학습한 매거진·블로그 콘텐츠로 답하는 AI 도슨트, 마에스트로와 대화해보세요.",
};

const EXAMPLES = [
  "이번 호 핵심만 요약해줘",
  "이 작곡가에 대해 더 알려줘",
  "비슷한 공연 추천해줘",
  "용어가 어려워요, 쉽게 설명해줘",
];

export default function AiMaestroPage() {
  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <span className="font-label text-[11px] font-bold uppercase tracking-[0.25em] text-[#6f5c24]">
          AI Maestro
        </span>
        <h1 className="mt-3 font-headline text-4xl leading-tight tracking-tight md:text-5xl">
          무엇이든 물어보세요
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[#444748]">
          STAGE가 학습한 매거진·블로그 콘텐츠를 바탕으로, 작품 배경부터 작곡가,
          공연 정보까지 대화로 답하는 AI 도슨트입니다. 답변에는 참고한 출처가
          함께 표시됩니다.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <span
              key={q}
              className="rounded-full border border-[#6f5c24]/30 bg-white px-4 py-2 text-sm text-[#6f5c24]"
            >
              {q}
            </span>
          ))}
        </div>

        <div className="mt-8 flex h-[60vh] min-h-[440px] flex-col rounded-2xl border border-[#1c1b1b]/10 bg-white p-5 shadow-sm">
          <ChatBody />
        </div>
      </main>
      <Footer />
    </div>
  );
}

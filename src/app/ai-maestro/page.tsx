import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { ChatBody } from "@/components/public/docent-chat";

export const metadata: Metadata = {
  title: "AI 마에스트로 | STAGE",
  description:
    "STAGE가 학습한 매거진·기사 콘텐츠로 답하는 AI 도슨트, 마에스트로와 대화해보세요.",
};

export default function AiMaestroPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <span className="font-label text-[11px] font-bold uppercase tracking-[0.25em] text-teal-deep">
          AI Maestro
        </span>
        <h1 className="font-headline mt-3 text-4xl leading-tight tracking-tight text-ink md:text-5xl">
          무엇이든 물어보세요
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
          STAGE가 읽은 매거진·기사 콘텐츠를 바탕으로, 작품 배경부터 작곡가,
          공연 정보까지 대화로 답하는 AI 도슨트입니다. 답변에는 참고한 출처가
          함께 표시됩니다.
        </p>

        <div className="mt-8 flex h-[60vh] min-h-[440px] flex-col border border-ink/10 bg-white p-5">
          <ChatBody />
        </div>
      </main>
      <Footer />
    </div>
  );
}

"use client";

import Link from "next/link";

// 홈 — AI 마에스트로 인라인 (v2 page-home §E): 다크 카드 + 보라 배지 차용.
// 추천 질문 칩 클릭 → 도슨트 챗(DocentChatFAB) 오픈.
const EXAMPLES = [
  "이 작곡가에 대해 더 알려줘",
  "비슷한 공연 추천해줘",
  "이번 호 핵심만 요약해줘",
];

function openDocent() {
  window.dispatchEvent(new Event("stage:open-docent"));
}

export function MaestroSection() {
  return (
    <section className="mt-14">
      <div className="rounded-[10px] border border-white/5 bg-ink-deep p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              🎼
            </span>
            <span className="font-headline text-base font-bold text-white sm:text-[17px]">
              AI 마에스트로에게 물어보세요
            </span>
          </div>
          <span className="flex-shrink-0 rounded-full bg-os-purple/15 px-2 py-1 font-label text-[8px] uppercase tracking-[2px] text-os-purple-light/70">
            Gemini · RAG
          </span>
        </div>

        <p className="mt-2.5 text-[11px] leading-relaxed text-white/35">
          STAGE가 학습한 매거진·기사·공연 내용을 바탕으로 답합니다. 읽는 흐름을
          끊지 않고, 궁금한 순간 자연어로 물어보세요.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={openDocent}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-white/50 transition-colors hover:border-gold/40 hover:text-white/80"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="mt-3.5 flex items-center gap-4">
          <button
            type="button"
            onClick={openDocent}
            className="font-label text-[11px] font-bold text-gold transition-opacity hover:opacity-80"
          >
            대화 시작하기 →
          </button>
          <Link
            href="/ai-maestro"
            className="font-label text-[11px] text-gold/70 transition-colors hover:text-gold"
          >
            전용 페이지
          </Link>
        </div>
      </div>
    </section>
  );
}

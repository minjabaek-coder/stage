"use client";

import Link from "next/link";

// 홈 — AI 마에스트로 소개 섹션. CTA는 커스텀 이벤트로 도슨트 챗(DocentChatFAB)을 연다.
const EXAMPLES = [
  "이 작곡가에 대해 더 알려줘",
  "비슷한 공연 추천해줘",
  "이 용어가 어려워요",
  "이번 호 핵심만 요약해줘",
];

function openDocent() {
  window.dispatchEvent(new Event("stage:open-docent"));
}

export function MaestroSection() {
  return (
    <section className="mt-32">
      <div className="border-t border-[#1c1b1b]/10 pt-16">
        <span className="font-label text-[11px] font-bold uppercase tracking-[0.25em] text-[#6f5c24]">
          AI 마에스트로
        </span>

        <div className="mt-6 grid gap-12 md:grid-cols-2 md:items-end">
          <div>
            <h2 className="font-headline text-4xl leading-[1.1] tracking-tight md:text-5xl">
              읽다가 궁금하면,
              <br />
              마에스트로에게 물어보세요
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#444748] opacity-90">
              STAGE가 학습한 매거진·블로그 콘텐츠를 바탕으로 작품 배경부터
              작곡가, 공연 정보까지 대화로 답하는 AI 도슨트입니다. 읽는 흐름을
              끊지 않고, 궁금한 순간 바로 물어보세요.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={openDocent}
                className="inline-block bg-[#1c1b1b] px-8 py-3 font-label text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24]"
              >
                마에스트로에게 물어보기
              </button>
              <Link
                href="/ai-maestro"
                className="font-label text-[11px] font-bold uppercase tracking-widest text-[#6f5c24] hover:underline"
              >
                전용 페이지에서 대화하기 →
              </Link>
            </div>
          </div>

          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] opacity-40">
              이런 걸 물어볼 수 있어요
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={openDocent}
                  className="rounded-full border border-[#6f5c24]/30 bg-white px-4 py-2 text-sm text-[#6f5c24] transition-colors hover:border-[#6f5c24] hover:bg-[#6f5c24]/5"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

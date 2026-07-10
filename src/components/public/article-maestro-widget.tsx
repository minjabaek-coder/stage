"use client";

import { useEffect } from "react";
import { setCurrentArticleTitle } from "@/lib/article-context";

// 기사 내 AI 위젯 — 클릭 시 도슨트 챗을 열고 이 기사 관련 질문을 입력창에 미리 채운다.
// 또한 현재 기사 제목을 전역에 설정 → FAB로 연 도슨트도 "이 기사"를 이해한다.
export function ArticleMaestroWidget({ title }: { title: string }) {
  useEffect(() => {
    setCurrentArticleTitle(title);
    return () => setCurrentArticleTitle(null);
  }, [title]);

  function ask(question: string) {
    window.dispatchEvent(
      new CustomEvent("stage:open-docent", { detail: { question } }),
    );
  }

  const prompts = [
    { label: "이 기사 요약", q: `"${title}" 기사를 요약해줘` },
    { label: "쉽게 설명", q: `"${title}" 기사를 쉽게 설명해줘` },
    { label: "관련 추천", q: `"${title}"와 관련해 더 볼 만한 것을 추천해줘` },
  ];

  return (
    <div className="mt-12 rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-6">
      <p className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-[#6f5c24]">
        AI 마에스트로
      </p>
      <p className="mt-2 text-sm text-[#444748]">
        이 기사가 더 궁금하다면 마에스트로에게 물어보세요.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => ask(p.q)}
            className="rounded-full border border-[#6f5c24]/30 bg-white px-4 py-2 text-sm text-[#6f5c24] transition-colors hover:border-[#6f5c24] hover:bg-[#6f5c24]/5"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

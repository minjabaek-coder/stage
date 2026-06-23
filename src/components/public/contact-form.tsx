"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { submitInquiry } from "@/actions/contact-actions";

type State = { error?: string; success?: boolean } | undefined;

// 유형별 입력 항목 구성 (레퍼런스 인콰이어리 폼 참고).
// B2B(광고·제휴·StageOS)는 회사/연락처/세부, 제보는 분야/제목, 일반·기타는 최소.
type TypeConfig = {
  nameLabel: string;
  company?: boolean;
  phone?: boolean;
  detail?: { label: string; options: string[] };
  title?: boolean;
};
const TYPE_CONFIG: Record<string, TypeConfig> = {
  일반: { nameLabel: "이름" },
  광고: {
    nameLabel: "담당자명",
    company: true,
    phone: true,
    detail: {
      label: "광고 희망 영역",
      options: ["홈 배너", "매거진 내", "기사 내", "뉴스레터", "기타"],
    },
  },
  제휴: {
    nameLabel: "담당자명",
    company: true,
    phone: true,
    detail: {
      label: "제휴 분야",
      options: ["콘텐츠 제휴", "공동 기획", "행사·티켓", "기타"],
    },
  },
  "StageOS 도입": {
    nameLabel: "담당자명",
    company: true,
    phone: true,
    detail: {
      label: "기관 유형",
      options: ["공연장", "축제·페스티벌", "전시·미술관", "교육기관", "기타"],
    },
  },
  "기사 제보": {
    nameLabel: "이름",
    phone: true,
    detail: {
      label: "제보 분야",
      options: ["공연", "전시", "인물", "이슈", "기타"],
    },
    title: true,
  },
  기타: { nameLabel: "이름" },
};
const TYPES = Object.keys(TYPE_CONFIG);

const fieldClass =
  "mt-1 w-full border-b border-ink/20 bg-transparent py-2 text-sm text-ink focus:border-gold-deep focus:outline-none";
const labelClass =
  "font-label text-[11px] uppercase tracking-wider text-gold-deep";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submitInquiry,
    undefined,
  );
  const [type, setType] = useState("일반");
  const cfg = TYPE_CONFIG[type];
  const isTip = type === "기사 제보";

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-gold-deep/20 bg-surface-input p-10 text-center">
        <p className="font-headline text-2xl text-ink">
          {isTip ? "제보가 접수되었습니다" : "문의가 접수되었습니다"}
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          빠른 시일 내에 입력하신 이메일로 답변드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="type" className={labelClass}>
          유형
        </label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={fieldClass}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "기사 제보" ? "기사 제보" : `${t} 문의`}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            {cfg.nameLabel}
          </label>
          <input id="name" name="name" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={fieldClass}
          />
        </div>
      </div>

      {(cfg.company || cfg.phone) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {cfg.company && (
            <div>
              <label htmlFor="company" className={labelClass}>
                회사/기관명
              </label>
              <input id="company" name="company" className={fieldClass} />
            </div>
          )}
          {cfg.phone && (
            <div>
              <label htmlFor="phone" className={labelClass}>
                연락처 {isTip ? "(선택)" : ""}
              </label>
              <input id="phone" name="phone" className={fieldClass} />
            </div>
          )}
        </div>
      )}

      {cfg.detail && (
        <div>
          <label htmlFor="detail" className={labelClass}>
            {cfg.detail.label}
          </label>
          <select
            id="detail"
            name="detail"
            defaultValue=""
            className={fieldClass}
          >
            <option value="">선택해주세요</option>
            {cfg.detail.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      )}

      {cfg.title && (
        <div>
          <label htmlFor="title" className={labelClass}>
            제보 제목
          </label>
          <input id="title" name="title" required className={fieldClass} />
        </div>
      )}

      <div>
        <label htmlFor="message" className={labelClass}>
          {isTip ? "제보 내용" : "문의 내용"}
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="mt-1 w-full border-b border-ink/20 bg-transparent py-2 text-sm text-ink focus:border-gold-deep focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-ink px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        {pending ? "보내는 중..." : isTip ? "제보 보내기" : "문의 보내기"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { submitContact } from "@/actions/contact-actions";

type State = { error?: string; success?: boolean } | undefined;

const TYPES = ["일반", "제휴", "광고", "StageOS 도입", "기타"];

const fieldClass =
  "mt-1 w-full border-b border-[#1c1b1b]/20 bg-transparent py-2 text-sm focus:border-[#6f5c24] focus:outline-none";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submitContact,
    undefined,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-10 text-center">
        <p className="font-headline text-2xl">문의가 접수되었습니다</p>
        <p className="mt-3 text-sm text-[#444748]">
          빠른 시일 내에 입력하신 이메일로 답변드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
          >
            이름
          </label>
          <input id="name" name="name" required className={fieldClass} />
        </div>
        <div>
          <label
            htmlFor="email"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
          >
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

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="company"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
          >
            회사/단체 (선택)
          </label>
          <input id="company" name="company" className={fieldClass} />
        </div>
        <div>
          <label
            htmlFor="type"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
          >
            문의 유형
          </label>
          <select id="type" name="type" className={fieldClass} defaultValue="일반">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="message"
          className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
        >
          문의 내용
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="mt-1 w-full border-b border-[#1c1b1b]/20 bg-transparent py-2 text-sm focus:border-[#6f5c24] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24] disabled:opacity-50"
      >
        {pending ? "보내는 중..." : "문의 보내기"}
      </button>
    </form>
  );
}

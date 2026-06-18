"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { submitTip } from "@/actions/tip-actions";

type State = { error?: string; success?: boolean } | undefined;

const CATEGORIES = ["공연/전시", "인물", "이슈", "보도자료", "기타"];

const fieldClass =
  "mt-1 w-full border-b border-[#1c1b1b]/20 bg-transparent py-2 text-sm focus:border-[#6f5c24] focus:outline-none";

export function TipForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(
    submitTip,
    undefined,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-[#6f5c24]/20 bg-[#faf7f2] p-10 text-center">
        <p className="font-headline text-2xl">제보가 접수되었습니다</p>
        <p className="mt-3 text-sm text-[#444748]">
          소중한 제보 감사합니다. 검토 후 필요 시 연락드리겠습니다.
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
            htmlFor="phone"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
          >
            연락처 (선택)
          </label>
          <input id="phone" name="phone" className={fieldClass} />
        </div>
        <div>
          <label
            htmlFor="category"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
          >
            분류
          </label>
          <select
            id="category"
            name="category"
            className={fieldClass}
            defaultValue="공연/전시"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="title"
          className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
        >
          제목
        </label>
        <input id="title" name="title" required className={fieldClass} />
      </div>

      <div>
        <label
          htmlFor="content"
          className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
        >
          제보 내용
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={8}
          className="mt-1 w-full border-b border-[#1c1b1b]/20 bg-transparent py-2 text-sm focus:border-[#6f5c24] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24] disabled:opacity-50"
      >
        {pending ? "보내는 중..." : "제보 보내기"}
      </button>
    </form>
  );
}

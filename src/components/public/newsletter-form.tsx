"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribeNewsletter } from "@/actions/newsletter-actions";
import { toast } from "sonner";

export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(
    subscribeNewsletter,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success("구독해주셔서 감사합니다!");
      formRef.current?.reset();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <input
        name="email"
        type="email"
        required
        placeholder="이메일 주소"
        className="w-full bg-transparent border-b border-[#1c1b1b]/20 py-2 font-label text-xs mb-4 focus:outline-none focus:border-[#6f5c24] transition-colors placeholder:opacity-50"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#1c1b1b] text-white py-3 font-label text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-[#6f5c24] disabled:opacity-50"
      >
        {pending ? "구독 중..." : "구독하기"}
      </button>
    </form>
  );
}

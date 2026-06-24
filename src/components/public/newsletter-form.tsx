"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribeNewsletter } from "@/actions/newsletter-actions";
import { toast } from "sonner";

export function NewsletterForm({
  source = "home",
  submitLabel = "구독하기",
  pendingLabel = "구독 중...",
  successMessage = "구독해주셔서 감사합니다!",
  placeholder = "이메일 주소",
}: {
  source?: string;
  submitLabel?: string;
  pendingLabel?: string;
  successMessage?: string;
  placeholder?: string;
} = {}) {
  const [state, formAction, pending] = useActionState(
    subscribeNewsletter,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(successMessage);
      formRef.current?.reset();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, successMessage]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="source" value={source} />
      <input
        name="email"
        type="email"
        required
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-ink/20 py-2 font-label text-xs mb-4 text-ink focus:outline-none focus:border-gold-deep transition-colors placeholder:opacity-50"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink text-white py-3 font-label text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

type State = { error?: string } | undefined;

export function AuthForm({
  action,
  mode,
}: {
  action: (state: State, formData: FormData) => Promise<State>;
  mode: "login" | "signup";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-headline text-3xl tracking-tight text-ink">
        {isSignup ? "회원가입" : "로그인"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {isSignup
          ? "STAGE 회원이 되어 매거진·기사와 AI 마에스트로를 만나보세요."
          : "다시 오신 것을 환영합니다."}
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="font-label text-[11px] uppercase tracking-wider text-gold-deep"
          >
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full border-b border-ink/20 bg-transparent py-2 text-sm text-ink focus:border-gold-deep focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="font-label text-[11px] uppercase tracking-wider text-gold-deep"
          >
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="6자 이상"
            className="mt-1 w-full border-b border-ink/20 bg-transparent py-2 text-sm text-ink placeholder:opacity-40 focus:border-gold-deep focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-ink py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep disabled:opacity-50"
        >
          {pending ? "처리 중..." : isSignup ? "가입하기" : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {isSignup ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
        <Link
          href={isSignup ? "/auth/login" : "/auth/signup"}
          className="font-medium text-gold-deep hover:underline"
        >
          {isSignup ? "로그인" : "회원가입"}
        </Link>
      </p>

      <p className="mt-8 text-center font-label text-[10px] uppercase tracking-wider text-ink/40">
        소셜 로그인(카카오·네이버·구글)은 준비 중입니다
      </p>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/profile-actions";

const GENRES = [
  "클래식",
  "오페라",
  "발레·무용",
  "연극·뮤지컬",
  "미술·전시",
  "국악·전통",
  "재즈·대중음악",
  "영화·영상",
  "문학",
];

type State = { error?: string; success?: boolean } | undefined;

// 설정 섹션 전용 — 이름·관심 장르·수신 설정 편집. (개요/등급/이메일은 마이페이지가 소유)
export function ProfileForm({
  name,
  interests,
  newsletterOptIn,
  eventAlertOptIn,
}: {
  name: string;
  interests: string[];
  newsletterOptIn: boolean;
  eventAlertOptIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    updateProfile,
    undefined,
  );
  const [selected, setSelected] = useState<string[]>(interests);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success) toast.success("프로필이 저장되었습니다.");
  }, [state]);

  const toggleGenre = (g: string) =>
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  return (
    <form action={formAction} className="space-y-10">
      {/* 이름 */}
      <div>
        <label
          htmlFor="name"
          className="font-label text-[11px] uppercase tracking-wider text-gold-deep"
        >
          이름
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={name}
          maxLength={40}
          placeholder="표시될 이름"
          className="mt-1 w-full border-b border-ink/20 bg-transparent py-2 text-sm text-ink placeholder:opacity-40 focus:border-gold-deep focus:outline-none"
        />
      </div>

      {/* 관심 장르 */}
      <div>
        <p className="font-label text-[11px] uppercase tracking-wider text-gold-deep">
          관심 장르
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          관심 있는 분야를 선택하면 맞춤 추천과 공연 알림에 활용됩니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const active = selected.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGenre(g)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-ink/20 text-ink-muted hover:border-gold-deep hover:text-gold-deep"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
        {selected.map((g) => (
          <input key={g} type="hidden" name="interests" value={g} />
        ))}
      </div>

      {/* 수신 설정 */}
      <div className="space-y-3">
        <p className="font-label text-[11px] uppercase tracking-wider text-gold-deep">
          수신 설정
        </p>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="newsletterOptIn"
            defaultChecked={newsletterOptIn}
            className="h-4 w-4 accent-ink"
          />
          뉴스레터 받기 (신규 매거진·기획 소식)
        </label>
        <label className="flex items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="eventAlertOptIn"
            defaultChecked={eventAlertOptIn}
            className="h-4 w-4 accent-ink"
          />
          공연·전시 알림 받기
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-ink px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep disabled:opacity-50"
      >
        {pending ? "저장 중..." : "저장하기"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/profile-actions";
import type { CurrentUser } from "@/hooks/use-user";

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

const TIER_LABEL: Record<CurrentUser["tier"], string> = {
  guest: "게스트",
  member: "멤버",
  pro: "프로",
};

const TIER_CLASS: Record<CurrentUser["tier"], string> = {
  guest: "bg-gray-100 text-gray-500",
  member: "bg-[#1c1b1b] text-white",
  pro: "bg-[#6f5c24] text-white",
};

type State = { error?: string; success?: boolean } | undefined;

export function ProfileForm({
  email,
  tier,
  proExpiresAt,
  name,
  interests,
  newsletterOptIn,
  eventAlertOptIn,
}: {
  email: string;
  tier: CurrentUser["tier"];
  proExpiresAt: string | null;
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
    <div>
      <h1 className="font-headline text-4xl tracking-tight">마이페이지</h1>

      {/* 계정 요약 */}
      <div className="mt-8 flex items-center gap-3 border-b border-[#1c1b1b]/10 pb-6">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${TIER_CLASS[tier]}`}
        >
          {TIER_LABEL[tier]}
        </span>
        <span className="text-sm text-[#444748]">{email}</span>
      </div>
      {tier === "pro" && proExpiresAt && (
        <p className="mt-3 font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
          프로 멤버십 만료 ·{" "}
          {new Date(proExpiresAt).toLocaleDateString("ko-KR")}
        </p>
      )}

      <form action={formAction} className="mt-10 space-y-10">
        {/* 이름 */}
        <div>
          <label
            htmlFor="name"
            className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]"
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
            className="mt-1 w-full border-b border-[#1c1b1b]/20 bg-transparent py-2 text-sm placeholder:opacity-40 focus:border-[#6f5c24] focus:outline-none"
          />
        </div>

        {/* 관심 장르 */}
        <div>
          <p className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
            관심 장르
          </p>
          <p className="mt-1 text-xs text-[#444748]">
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
                      ? "border-[#1c1b1b] bg-[#1c1b1b] text-white"
                      : "border-[#1c1b1b]/20 text-[#444748] hover:border-[#6f5c24] hover:text-[#6f5c24]"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
          {/* 선택 장르를 hidden input으로 폼에 반영 */}
          {selected.map((g) => (
            <input key={g} type="hidden" name="interests" value={g} />
          ))}
        </div>

        {/* 수신 설정 */}
        <div className="space-y-3">
          <p className="font-label text-[11px] uppercase tracking-wider text-[#6f5c24]">
            수신 설정
          </p>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="newsletterOptIn"
              defaultChecked={newsletterOptIn}
              className="h-4 w-4 accent-[#1c1b1b]"
            />
            뉴스레터 받기 (신규 매거진·기획 소식)
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="eventAlertOptIn"
              defaultChecked={eventAlertOptIn}
              className="h-4 w-4 accent-[#1c1b1b]"
            />
            공연·전시 알림 받기
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="bg-[#1c1b1b] px-8 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#6f5c24] disabled:opacity-50"
        >
          {pending ? "저장 중..." : "저장하기"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  tier: "guest" | "member" | "pro";
  avatarUrl: string | null;
};

// 현재 로그인 유저를 /api/me에서 가져온다. (로그인/로그아웃은 서버액션 redirect로
// 전체 네비게이션이 일어나므로 마운트 시 1회 fetch면 충분)
export function useUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setUser(d.user ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}

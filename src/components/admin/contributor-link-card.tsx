"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  issueArticleToken,
  revokeArticleToken,
  setArticleTokenExpiry,
} from "@/actions/article-token-actions";

const TTL_OPTIONS = [
  { days: 7, label: "7일" },
  { days: 14, label: "14일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
  { days: 0, label: "무기한" },
];

// 만료일 라벨(핸들러에서만 계산 — 렌더 순수성 유지). ttl=0이면 무기한.
function expiryLabel(ttlDays: number): string {
  if (ttlDays <= 0) return "유효 · 무기한";
  const d = new Date(Date.now() + ttlDays * 86_400_000);
  return `유효 · ${d.toLocaleDateString("ko-KR")} 만료`;
}

export function ContributorLinkCard({
  articleId,
  initial,
}: {
  articleId: string;
  // 상태는 서버(편집 페이지)에서 평가해 전달 — 카드 렌더에서 현재시각 계산 안 함.
  initial: { exists: boolean; active: boolean; statusLabel: string };
}) {
  const [ttl, setTtl] = useState(30);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState(initial);

  async function handleIssue() {
    setPending(true);
    const res = await issueArticleToken(articleId, ttl);
    setPending(false);
    if (res.error) return toast.error(res.error);
    if (res.token) {
      setIssuedLink(`${window.location.origin}/contribute/${res.token}`);
      setState({ exists: true, active: true, statusLabel: expiryLabel(ttl) });
      toast.success("기고자 링크를 발급했습니다 (지금만 표시)");
    }
  }

  async function handleExtend() {
    setPending(true);
    const res = await setArticleTokenExpiry(articleId, ttl);
    setPending(false);
    if (res?.error) return toast.error(res.error);
    setState((s) => ({ ...s, active: true, statusLabel: expiryLabel(ttl) }));
    toast.success("유효기간을 변경했습니다 (기존 링크 유지)");
  }

  async function handleRevoke() {
    setPending(true);
    const res = await revokeArticleToken(articleId);
    setPending(false);
    if (res?.error) return toast.error(res.error);
    setIssuedLink(null);
    setState((s) => ({ ...s, active: false, statusLabel: "회수됨" }));
    toast.success("링크를 회수했습니다");
  }

  function copy() {
    if (!issuedLink) return;
    navigator.clipboard.writeText(issuedLink);
    toast.success("링크를 복사했습니다");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          기고자 링크
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
              state.active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {state.statusLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          로그인 없이 원고를 작성할 수 있는 링크입니다. 평문 링크는 발급 직후
          한 번만 표시됩니다. 발행 시 자동 무효화됩니다.
        </p>

        {issuedLink && (
          <div className="space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[11px] font-medium text-emerald-700">
              새 링크 (지금만 표시 — 복사해 전달하세요)
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={issuedLink}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded border bg-white px-2 py-1 text-xs"
              />
              <Button type="button" size="sm" onClick={copy}>
                복사
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">유효기간</label>
          <select
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
            className="rounded border px-2 py-1 text-xs"
          >
            {TTL_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={handleIssue} disabled={pending}>
            {state.exists ? "재발급" : "발급"}
          </Button>
          {state.active && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExtend}
                disabled={pending}
              >
                기간 변경
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRevoke}
                disabled={pending}
              >
                회수
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

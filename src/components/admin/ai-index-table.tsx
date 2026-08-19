"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reindexSource, type IndexSourceType } from "@/actions/embedding-actions";

export type IndexRow = {
  type: IndexSourceType;
  id: string;
  label: string;
  href: string;
  note: string;
  /** 색인 '대상'인가 — 대상이 아니면 청크 0이 정상이다. */
  expected: boolean;
  chunks: number;
  lastAt: string | null;
};

const TYPE_LABEL: Record<IndexSourceType, string> = {
  article: "기사",
  magazine: "매거진",
  culture: "문화예술",
};

export function AiIndexTable({ rows }: { rows: IndexRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const shown = onlyProblems ? rows.filter((r) => r.expected && r.chunks === 0) : rows;

  function reindex(r: IndexRow) {
    setBusyId(r.id);
    start(async () => {
      const res = await reindexSource(r.type, r.id);
      setBusyId(null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      router.refresh();
      toast.success(`재색인했습니다 — ${r.label}`);
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={onlyProblems}
          onChange={(e) => setOnlyProblems(e.target.checked)}
          className="h-4 w-4"
        />
        미색인만 보기
      </label>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">종류</th>
              <th className="px-3 py-2 font-medium">대상</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 text-right font-medium">청크</th>
              <th className="px-3 py-2 font-medium">마지막 색인</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  {onlyProblems ? "미색인 항목이 없습니다." : "발행된 콘텐츠가 없습니다."}
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const problem = r.expected && r.chunks === 0;
              return (
                <tr key={`${r.type}:${r.id}`} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                    {TYPE_LABEL[r.type]}
                  </td>
                  <td className="max-w-[26rem] px-3 py-2">
                    <Link href={r.href} target="_blank" className="hover:underline">
                      {r.label}
                    </Link>
                    {r.note && (
                      <span className="ml-2 text-[11px] text-gray-400">{r.note}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {problem ? (
                      <span className="font-medium text-red-600">미색인</span>
                    ) : r.chunks > 0 ? (
                      <span className="text-emerald-600">색인됨</span>
                    ) : (
                      <span className="text-gray-400">대상 아님</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                    {r.chunks}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                    {r.lastAt ? new Date(r.lastAt).toLocaleString("ko-KR") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reindex(r)}
                      disabled={pending}
                    >
                      {busyId === r.id ? "색인 중..." : "재색인"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        재색인은 해당 소스의 청크를 지우고 다시 만듭니다. 임베딩 호출이 있어 몇 초 걸릴 수
        있습니다. 전체를 한 번에 돌리려면 <code>POST /api/admin/backfill-embeddings</code>
        (레이트 한도 때문에 항목마다 21초 간격이라 오래 걸립니다).
      </p>
    </div>
  );
}

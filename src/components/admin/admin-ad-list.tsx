"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleAdActive, deleteAd } from "@/actions/ad-actions";
import type { Advertisement } from "@/generated/prisma/client";

export function AdminAdList({ initial }: { initial: Advertisement[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle(ad: Advertisement) {
    const next = !ad.isActive;
    setItems((prev) =>
      prev.map((x) => (x.id === ad.id ? { ...x, isActive: next } : x)),
    );
    startTransition(async () => {
      await toggleAdActive(ad.id, next);
    });
  }

  function remove(id: string) {
    if (!confirm("이 광고를 삭제하시겠습니까?")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await deleteAd(id);
      toast.success("삭제되었습니다");
    });
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">등록된 광고가 없습니다.</p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((ad) => (
        <div
          key={ad.id}
          className={`flex items-center gap-4 rounded-lg border p-3 ${
            ad.isActive ? "bg-white" : "bg-gray-50 opacity-70"
          }`}
        >
          {ad.imageUrl ? (
            <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded">
              <img
                src={ad.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-14 w-24 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-gray-800 to-gray-950">
              <span className="text-[9px] font-bold tracking-wider text-white/80">
                STAGE AD
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ad.type}</Badge>
              {ad.isActive ? (
                <Badge className="bg-[#1c1b1b] text-white">활성</Badge>
              ) : (
                <Badge className="bg-gray-400 text-white">비활성</Badge>
              )}
              <span className="font-medium">{ad.title}</span>
            </div>
            <p className="mt-1 truncate text-sm text-gray-500">
              {ad.sponsor} · {ad.linkUrl}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              노출 {ad.impressions.toLocaleString()} · 클릭{" "}
              {ad.clicks.toLocaleString()}
              {ad.placement.length > 0 && ` · 위치: ${ad.placement.join(", ")}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggle(ad)}
            >
              {ad.isActive ? "비활성화" : "활성화"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/ads/${ad.id}/edit`)}
            >
              수정
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => remove(ad.id)}
            >
              삭제
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

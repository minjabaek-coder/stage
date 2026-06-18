"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setContactStatus, deleteContact } from "@/actions/contact-actions";
import { formatKST } from "@/lib/format";
import type { Contact } from "@/generated/prisma/client";

export function AdminContactList({ initial }: { initial: Contact[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle(c: Contact) {
    const next = c.status === "done" ? "new" : "done";
    setItems((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, status: next } : x)),
    );
    startTransition(async () => {
      await setContactStatus(c.id, next);
    });
  }

  function remove(id: string) {
    if (!confirm("이 문의를 삭제하시겠습니까?")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      await deleteContact(id);
      toast.success("삭제되었습니다");
    });
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-gray-400">받은 문의가 없습니다.</p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((c) => (
        <div
          key={c.id}
          className={`rounded-lg border p-4 ${
            c.status === "done" ? "bg-gray-50 opacity-70" : "bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{c.type}</Badge>
                {c.status === "done" ? (
                  <Badge className="bg-gray-500 text-white">처리완료</Badge>
                ) : (
                  <Badge className="bg-[#6f5c24] text-white">미처리</Badge>
                )}
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-sm text-gray-400">{c.email}</span>
                {c.company && (
                  <span className="text-sm text-gray-400">· {c.company}</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-700">
                {c.message}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {formatKST(c.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggle(c)}
              >
                {c.status === "done" ? "미처리로" : "처리완료"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => remove(c.id)}
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

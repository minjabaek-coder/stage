export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { AdminTipList } from "@/components/admin/admin-tip-list";

export default async function AdminTipsPage() {
  const tips = await prisma.tip.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const newCount = tips.filter((t) => t.status !== "done").length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">제보 수신함</h1>
        <span className="text-sm text-gray-500">미처리 {newCount}건</span>
      </div>
      <AdminTipList initial={tips} />
    </div>
  );
}

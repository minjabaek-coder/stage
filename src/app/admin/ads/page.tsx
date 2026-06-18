export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { AdminAdList } from "@/components/admin/admin-ad-list";

export default async function AdminAdsPage() {
  const ads = await prisma.advertisement.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">광고 관리</h1>
        <Link href="/admin/ads/new">
          <Button>새 광고</Button>
        </Link>
      </div>
      <AdminAdList initial={ads} />
    </div>
  );
}

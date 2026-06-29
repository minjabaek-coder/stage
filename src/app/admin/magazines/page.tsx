export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { MagazineListTable } from "@/components/admin/magazine-list-table";

export default async function AdminMagazinesPage() {
  const rows = await prisma.magazine.findMany({
    include: {
      _count: { select: { pages: true } },
      // 구성형 표지 폴백용 첫 페이지 layout
      pages: { orderBy: { sortOrder: "asc" }, take: 1, select: { layout: true } },
    },
    orderBy: { issueNumber: "desc" },
  });
  const magazines = rows.map(({ pages, ...m }) => ({
    ...m,
    coverLayout: m.contentType === "composed" ? pages[0]?.layout ?? null : null,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">매거진 관리</h1>
        <Link href="/admin/magazines/new">
          <Button>새 매거진</Button>
        </Link>
      </div>
      <MagazineListTable magazines={magazines} />
    </div>
  );
}

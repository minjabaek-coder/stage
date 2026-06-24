export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { MagazineListTable } from "@/components/admin/magazine-list-table";

export default async function AdminMagazinesPage() {
  const magazines = await prisma.magazine.findMany({
    include: { _count: { select: { pages: true } } },
    orderBy: { issueNumber: "desc" },
  });

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

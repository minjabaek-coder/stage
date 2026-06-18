export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { CultureEventListTable } from "@/components/admin/culture-event-list-table";

export default async function AdminCultureEventsPage() {
  const events = await prisma.cultureEvent.findMany({
    orderBy: { startDate: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">문화예술 관리</h1>
        <Link href="/admin/culture-events/new">
          <Button>새 이벤트</Button>
        </Link>
      </div>
      <CultureEventListTable events={events} />
    </div>
  );
}

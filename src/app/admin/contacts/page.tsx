export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { AdminContactList } from "@/components/admin/admin-contact-list";

export default async function AdminContactsPage() {
  const contacts = await prisma.contact.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const newCount = contacts.filter((c) => c.status !== "done").length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">문의 수신함</h1>
        <span className="text-sm text-gray-500">미처리 {newCount}건</span>
      </div>
      <AdminContactList initial={contacts} />
    </div>
  );
}

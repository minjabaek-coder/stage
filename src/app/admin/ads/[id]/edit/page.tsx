export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdForm } from "@/components/admin/ad-form";
import { updateAd } from "@/actions/ad-actions";

export default async function EditAdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ad = await prisma.advertisement.findUnique({ where: { id } });
  if (!ad) notFound();

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateAd(id, formData);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">광고 수정</h1>
      <AdForm
        key={String(ad.updatedAt)}
        action={action}
        defaultValues={{
          sponsor: ad.sponsor,
          title: ad.title,
          description: ad.description,
          imageUrl: ad.imageUrl,
          linkUrl: ad.linkUrl,
          type: ad.type,
          isActive: ad.isActive,
          startDate: ad.startDate,
          endDate: ad.endDate,
        }}
      />
    </div>
  );
}

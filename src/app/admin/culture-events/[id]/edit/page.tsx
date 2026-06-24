export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CultureEventForm } from "@/components/admin/culture-event-form";
import { CultureEventStatusActions } from "@/components/admin/culture-event-status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { updateCultureEvent } from "@/actions/culture-event-actions";

export default async function EditCultureEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await prisma.cultureEvent.findUnique({ where: { id } });
  if (!event) notFound();

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateCultureEvent(id, formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">이벤트 수정</h1>
          <StatusBadge status={event.status} />
        </div>
        <CultureEventStatusActions
          eventId={event.id}
          status={event.status}
          saveFormId="culture-event-edit-form"
        />
      </div>

      <div className="mx-auto max-w-3xl">
        <CultureEventForm
          key={String(event.updatedAt)}
          action={action}
          defaultValues={{
            title: event.title,
            slug: event.slug,
            type: event.type,
            genre: event.genre,
            venue: event.venue,
            address: event.address,
            artists: event.artists,
            description: event.description,
            thumbnailUrl: event.thumbnailUrl,
            startDate: event.startDate,
            endDate: event.endDate,
            ticketUrl: event.ticketUrl,
            ticketPrice: event.ticketPrice,
            memberDiscount: event.memberDiscount,
            eduInstructor: event.eduInstructor,
            eduSchedule: event.eduSchedule,
            maxParticipants: event.maxParticipants,
            applyUrl: event.applyUrl,
            isFeatured: event.isFeatured,
            sidebarFeatured: event.sidebarFeatured,
            publishedAt: event.publishedAt,
          }}
          formId="culture-event-edit-form"
        />
      </div>
    </div>
  );
}

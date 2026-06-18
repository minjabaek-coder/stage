import { CultureEventForm } from "@/components/admin/culture-event-form";
import { createCultureEvent } from "@/actions/culture-event-actions";

export default function NewCultureEventPage() {
  async function action(_state: unknown, formData: FormData) {
    "use server";
    return createCultureEvent(formData);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">새 문화예술 이벤트</h1>
      <CultureEventForm action={action} />
    </div>
  );
}

import { MagazineForm } from "@/components/admin/magazine-form";
import { createMagazine } from "@/actions/magazine-actions";

export default function NewMagazinePage() {
  async function action(_state: unknown, formData: FormData) {
    "use server";
    return createMagazine(formData);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">새 매거진</h1>
      <MagazineForm action={action} submitLabel="생성" showContentType />
    </div>
  );
}

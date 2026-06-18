import { AdForm } from "@/components/admin/ad-form";
import { createAd } from "@/actions/ad-actions";

export default function NewAdPage() {
  async function action(_state: unknown, formData: FormData) {
    "use server";
    return createAd(formData);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">새 광고</h1>
      <AdForm action={action} />
    </div>
  );
}

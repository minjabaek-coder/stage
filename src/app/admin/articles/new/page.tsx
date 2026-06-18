import { ArticleForm } from "@/components/admin/article-form";
import { createArticle } from "@/actions/article-actions";

export default function NewArticlePage() {
  async function action(_state: unknown, formData: FormData) {
    "use server";
    return createArticle(formData);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">새 기사</h1>
      <ArticleForm action={action} />
    </div>
  );
}

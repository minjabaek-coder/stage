export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/admin/magazine-article-form";
import { createArticle } from "@/actions/magazine-article-actions";

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const magazine = await prisma.magazine.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!magazine) notFound();

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return createArticle(id, _state, formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/magazines/${id}/edit`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {magazine.title}
          </Link>
          <h1 className="text-2xl font-bold">새 아티클</h1>
        </div>
        <button
          type="submit"
          form="article-new-form"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          생성
        </button>
      </div>

      <ArticleForm action={action} formId="article-new-form" />
    </div>
  );
}

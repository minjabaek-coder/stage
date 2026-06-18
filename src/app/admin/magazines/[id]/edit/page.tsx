export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MagazineForm } from "@/components/admin/magazine-form";
import { PageUploadZone } from "@/components/admin/page-upload-zone";
import { PageListSortable } from "@/components/admin/page-list-sortable";
import { ArticleListSortable } from "@/components/admin/magazine-article-list-sortable";
import { StatusActions } from "@/components/admin/status-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { TocEditor } from "@/components/admin/toc-editor";
import { updateMagazine } from "@/actions/magazine-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditMagazinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const magazine = await prisma.magazine.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      tocEntries: { orderBy: { sortOrder: "asc" } },
      articles: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!magazine) notFound();

  const isWeb = magazine.contentType === "web";

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateMagazine(id, formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">매거진 수정</h1>
          <StatusBadge status={magazine.status} />
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {isWeb ? "웹(구조화 텍스트)" : "이미지(JPG/WebP)"}
          </span>
        </div>
        <StatusActions
          magazineId={magazine.id}
          status={magazine.status}
          saveFormId="magazine-edit-form"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <MagazineForm
            action={action}
            defaultValues={{
              issueNumber: magazine.issueNumber,
              title: magazine.title,
              description: magazine.description,
              publishedAt: magazine.publishedAt,
            }}
            formId="magazine-edit-form"
          />

          {/* TOC editor only applies to image-based page magazines */}
          {!isWeb && (
            <Card>
              <CardHeader>
                <CardTitle>목차 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <TocEditor
                  magazineId={magazine.id}
                  initialEntries={magazine.tocEntries}
                  totalPages={magazine.pages.length}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {isWeb ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>아티클 관리</CardTitle>
              <Link
                href={`/admin/magazines/${magazine.id}/articles/new`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                + 새 아티클
              </Link>
            </CardHeader>
            <CardContent>
              {magazine.articles.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  아직 아티클이 없습니다. 위 버튼으로 추가하세요.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    ⠿ 드래그(모바일은 ↑↓)로 순서를 변경하면 뷰어 페이지 순서에
                    반영됩니다.
                  </p>
                  <ArticleListSortable
                    articles={magazine.articles}
                    magazineId={magazine.id}
                  />
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>페이지 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PageUploadZone magazineId={magazine.id} />
              <PageListSortable
                pages={magazine.pages}
                magazineId={magazine.id}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MagazineForm } from "@/components/admin/magazine-form";
import { PageUploadZone } from "@/components/admin/page-upload-zone";
import { PageListSortable } from "@/components/admin/page-list-sortable";
import { ComposedPageManager } from "@/components/admin/composed-page-manager";
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
    },
  });

  if (!magazine) notFound();

  const isWeb = magazine.contentType === "web";
  const isComposed = magazine.contentType === "composed";

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
            {isComposed
              ? "구성형(자유배치)"
              : isWeb
                ? "웹(구조화 텍스트)"
                : "이미지(JPG/WebP)"}
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
          {!isWeb && !isComposed && (
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

        {isComposed ? (
          <Card>
            <CardHeader>
              <CardTitle>페이지 구성 (자유배치)</CardTitle>
            </CardHeader>
            <CardContent>
              <ComposedPageManager
                magazineId={magazine.id}
                pages={magazine.pages.map((p) => ({
                  id: p.id,
                  pageNumber: p.pageNumber,
                  layout: p.layout,
                  articleId: p.articleId,
                }))}
              />
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

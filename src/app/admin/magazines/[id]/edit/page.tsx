export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MagazineForm } from "@/components/admin/magazine-form";
import { PageUploadZone } from "@/components/admin/page-upload-zone";
import { PageListSortable } from "@/components/admin/page-list-sortable";
import { MagazineEditorShell } from "@/components/admin/magazine-editor-shell";
import { EditorSettingsDialogs } from "@/components/admin/editor-settings-dialogs";
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

  const [magazine, articles] = await Promise.all([
    prisma.magazine.findUnique({
      where: { id },
      include: {
        pages: { orderBy: { sortOrder: "asc" } },
        tocEntries: { orderBy: { sortOrder: "asc" } },
      },
    }),
    // 구성형 페이지의 "싣는 기사" 연동 후보 — 단일 Article 모델(전체), 최신순
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, genre: true, subCategory: true },
    }),
  ]);

  if (!magazine) notFound();

  const isWeb = magazine.contentType === "web";
  const isComposed = magazine.contentType === "composed";

  async function action(_state: unknown, formData: FormData) {
    "use server";
    return updateMagazine(id, formData);
  }

  // 앱바 제목/상태(구성형·그외 공유)
  const titleBlock = (
    <div className="flex items-center gap-3">
      <h1 className="text-2xl font-bold">
        매거진 {isComposed ? "편집" : "수정"}
      </h1>
      <span className="text-sm text-muted-foreground">
        STAGE Issue {magazine.issueNumber}
      </span>
      <StatusBadge status={magazine.status} />
      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {isComposed
          ? "구성형(자유배치)"
          : isWeb
            ? "웹(구조화 텍스트)"
            : "이미지(JPG/WebP)"}
      </span>
    </div>
  );

  // 구성형: 어드민 헤더(57px) 아래 풀블리드 고정 레이어 — 캔바식 전체화면 에디터.
  // max-w-7xl·py-6 박스를 탈출해 캔버스가 가로/세로를 모두 활용(답답함 해소).
  // 매거진정보·목차는 앱바 모달(캔버스 안 가림)
  if (isComposed) {
    return (
      <div className="fixed inset-x-0 bottom-0 top-[57px] z-30 flex flex-col gap-2 bg-neutral-100 px-3 pb-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {titleBlock}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/magazines/${magazine.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-accent"
            >
              미리보기 ↗
            </a>
            <EditorSettingsDialogs
              action={action}
              defaultValues={{
                issueNumber: magazine.issueNumber,
                title: magazine.title,
                description: magazine.description,
                publishedAt: magazine.publishedAt,
              }}
              formId="magazine-edit-form"
              magazineId={magazine.id}
              tocEntries={magazine.tocEntries}
              totalPages={magazine.pages.length}
            />
            <StatusActions magazineId={magazine.id} status={magazine.status} />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <MagazineEditorShell
            magazineId={magazine.id}
            pages={magazine.pages.map((p) => ({
              id: p.id,
              pageNumber: p.pageNumber,
              layout: p.layout,
              articleId: p.articleId,
            }))}
            articles={articles}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {titleBlock}
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

          <Card>
            <CardHeader>
              <CardTitle>페이지 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PageUploadZone magazineId={magazine.id} />
              <PageListSortable pages={magazine.pages} magazineId={magazine.id} />
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MagazineForm } from "./magazine-form";
import { TocEditor } from "./toc-editor";
import type { MagazineTocEntry } from "@/types/magazine";

type FormState = { error?: string; success?: boolean } | undefined;

// 구성형 에디터 앱바의 "문서 설정" — 캔버스를 밀어내지 않도록 온디맨드 모달로.
// 캔바/PPT처럼 매거진 정보·목차는 오버레이로 열고, 에디터는 항상 뷰포트를 채운다.
export function EditorSettingsDialogs({
  action,
  defaultValues,
  formId,
  magazineId,
  tocEntries,
  totalPages,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues: {
    issueNumber?: number;
    title?: string;
    description?: string | null;
    publishedAt?: Date | null;
  };
  formId: string;
  magazineId: string;
  tocEntries: MagazineTocEntry[];
  totalPages: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const btn =
    "rounded-md border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-accent";

  return (
    <>
      <button type="button" className={btn} onClick={() => setInfoOpen(true)}>
        매거진 정보
      </button>
      <button type="button" className={btn} onClick={() => setTocOpen(true)}>
        목차{tocEntries.length > 0 ? ` · ${tocEntries.length}` : ""}
      </button>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>매거진 정보</DialogTitle>
          </DialogHeader>
          <MagazineForm
            action={action}
            defaultValues={defaultValues}
            formId={formId}
            bare
          />
        </DialogContent>
      </Dialog>

      <Dialog open={tocOpen} onOpenChange={setTocOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>목차 설정</DialogTitle>
          </DialogHeader>
          <TocEditor
            magazineId={magazineId}
            initialEntries={tocEntries}
            totalPages={totalPages}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateMagazineSourceText } from "@/actions/magazine-actions";
import { summarizeSourceText } from "@/lib/magazine-source-text";

// 텍스트 파일을 읽는다. 한국어 .txt는 Windows에서 CP949(EUC-KR)로 저장되는 일이 많아
// UTF-8로만 읽으면 깨진다 → UTF-8을 엄격 모드로 시도하고 실패하면 EUC-KR로 폴백.
async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return new TextDecoder().decode(buf);
    }
  }
}

// 매거진 원문 텍스트 카드 — 이미지형 매거진의 RAG 코퍼스 입력·관리.
// 페이지마다 입력하지 않고 한 곳에서 통째로 관리하되, `p.12` 마커로 페이지 귀속을 준다.
export function MagazineSourceText({
  magazineId,
  initialText,
  updatedAt,
  status,
}: {
  magazineId: string;
  initialText: string;
  updatedAt: string | null;
  status: string;
}) {
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(initialText);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => summarizeSourceText(text), [text]);
  const dirty = text !== saved;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;

    const loaded = await readTextFile(file);
    if (!loaded.trim()) {
      toast.error("파일에 텍스트가 없습니다");
      return;
    }
    // 이미 입력된 내용이 있으면 덮어쓸지(대체) 이어붙일지 고른다.
    if (text.trim()) {
      const replace = confirm(
        `"${file.name}"을(를) 불러옵니다.\n\n확인 = 기존 내용 아래에 이어붙이기\n취소 = 기존 내용을 전부 대체`,
      );
      setText(replace ? `${text.trimEnd()}\n\n${loaded.trim()}` : loaded.trim());
    } else {
      setText(loaded.trim());
    }
    toast.success(`${file.name} 불러옴 — 확인 후 저장하세요`);
  }

  function save() {
    start(async () => {
      const r = await updateMagazineSourceText(magazineId, text);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setSaved(text);
      if ("warning" in r) toast.warning(r.warning);
      else if (r.indexed) toast.success("저장하고 AI 색인을 갱신했습니다");
      else toast.success("저장했습니다 — 발행 시 AI 색인에 반영됩니다");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          매거진 원문 텍스트
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
            AI 마에스트로 · 검색용
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs leading-relaxed text-gray-500">
          이미지 페이지는 그림이라 AI가 내용을 읽을 수 없습니다. 여기에 매거진 내용을
          텍스트로 넣어두면 챗봇이 이 매거진에 대해 답하고, 답변에 출처 링크가 함께
          붙습니다.
        </p>

        <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">
            페이지 마커 쓰는 법 (선택)
          </summary>
          <div className="mt-2 space-y-1.5 leading-relaxed">
            <p>
              본문 중간에 <code className="rounded bg-white px-1">p.12</code> 처럼
              <b> 페이지 번호만 있는 줄</b>을 넣으면, 그 아래 내용은 12페이지 소속이
              됩니다. 챗봇 출처를 누르면 뷰어의 <b>그 페이지가 바로 열립니다.</b>
            </p>
            <p className="text-gray-500">
              인식 형식: <code>p.12</code> · <code>P 12</code> · <code>page 12</code> ·{" "}
              <code>12p</code> · <code>12페이지</code> · <code>12쪽</code> ·{" "}
              <code>--- p.12 ---</code> · <code>p.12-13</code>
            </p>
            <p className="text-gray-500">
              마커를 하나도 쓰지 않아도 됩니다. 그러면 매거진 전체 내용으로 색인되고
              출처는 매거진 첫 장으로 연결됩니다.
            </p>
          </div>
        </details>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          spellCheck={false}
          placeholder={
            "예)\np.1\n표지 — 2026 봄호 특집 '무대 위의 계절'\n\np.4\n편집장의 글. 이번 호는 ...\n\np.12\n피아니스트 OOO 인터뷰. ..."
          }
          className="block w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span>{summary.chars.toLocaleString()}자</span>
          <span>·</span>
          <span>
            페이지 마커 {summary.pages.length}개
            {summary.pages.length > 0 && (
              <span className="ml-1 text-gray-400">
                (
                {summary.pages.slice(0, 12).map((p) => `p.${p}`).join(", ")}
                {summary.pages.length > 12 ? " …" : ""})
              </span>
            )}
          </span>
          {status !== "published" && (
            <>
              <span>·</span>
              <span className="text-amber-600">발행 시 색인됩니다</span>
            </>
          )}
          {updatedAt && !dirty && (
            <>
              <span>·</span>
              <span>최종 저장 {new Date(updatedAt).toLocaleString("ko-KR")}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={pending || !dirty}>
            {pending ? "저장 중..." : dirty ? "저장" : "저장됨"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            텍스트 파일 불러오기
          </Button>
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setText(saved)}
              disabled={pending}
            >
              되돌리기
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}

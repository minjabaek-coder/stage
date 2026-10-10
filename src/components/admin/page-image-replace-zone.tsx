"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { compressImage } from "@/lib/image-client";
import { sortByFilename } from "@/lib/natural-sort";

export type ReplaceTargetPage = {
  id: string;
  pageNumber: number;
  sortOrder: number;
};

// 기존 페이지의 **이미지만** 순서대로 교체한다 (roadmap DR-C).
//
// 왜 일반 업로드와 분리하나: `PageUploadZone`은 행을 새로 만들어 **뒤에 붙인다.**
// 2026-10-10 사고로 Storage가 사라진 뒤 그 경로로 재업로드하면 죽은 페이지와 새 페이지가
// 중복되고, 목차는 pageNumber로 연결돼 있어 **죽은 앞쪽 절반을 가리킨다.**
//
// 이 화면의 책임은 **올리기 전에 매핑을 사람이 확인하게 하는 것**이다. 파일 순서가
// 페이지 순서가 되므로, 잘못 올리면 100쪽을 눈으로 되짚어야 한다. 그래서 드롭 즉시
// 올리지 않고 "무엇이 몇 쪽이 되는지"를 보여준 뒤 확인을 받는다.
export function PageImageReplaceZone({
  magazineId,
  pages,
}: {
  magazineId: string;
  pages: ReplaceTargetPage[];
}) {
  const [staged, setStaged] = useState<File[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const router = useRouter();

  const targets = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return;
    // 파일명 자연 정렬 — 사전식이면 10쪽이 2쪽 앞에 온다.
    setStaged(sortByFilename(accepted));
  }, []);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    for (const { file, errors } of rejections) {
      const tooLarge = errors.some((e) => e.code === "file-too-large");
      toast.error(
        tooLarge
          ? `${file.name}: 파일이 너무 큽니다 (최대 20MB)`
          : `${file.name}: 지원하지 않는 파일 형식입니다`
      );
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: Object.fromEntries(ACCEPTED_IMAGE_TYPES.map((t) => [t, []])),
    maxSize: MAX_FILE_SIZE,
    disabled: busy || staged !== null,
  });

  async function run() {
    if (!staged) return;
    const count = Math.min(staged.length, targets.length);
    setBusy(true);
    setProgress({ current: 0, total: count });

    let ok = 0;
    const failed: string[] = [];

    for (let i = 0; i < count; i++) {
      setProgress({ current: i + 1, total: count });
      const file = staged[i];
      const page = targets[i];
      try {
        const compressed = await compressImage(file);
        const body = new FormData();
        body.append("file", compressed);
        const res = await fetch(
          `/api/admin/magazines/${magazineId}/pages/${page.id}/image`,
          { method: "PUT", body }
        );
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const data = await res.json();
            if (data.error) msg = data.error;
          } catch {
            /* JSON이 아님 */
          }
          throw new Error(msg);
        }
        ok++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "네트워크 오류";
        // 실패한 쪽수를 모아서 알린다 — 100개 중 3개가 실패했을 때
        // 토스트 3개만 보고는 **어느 쪽을 다시 올려야 하는지** 알 수 없다.
        failed.push(`${page.pageNumber}쪽(${file.name}): ${msg}`);
      }
    }

    setBusy(false);
    setProgress({ current: 0, total: 0 });
    setStaged(null);

    if (ok > 0) {
      toast.success(`${ok}개 페이지의 이미지를 교체했습니다`);
      router.refresh();
    }
    if (failed.length > 0) {
      toast.error(
        `${failed.length}개 실패 — ${failed.slice(0, 3).join(" / ")}${
          failed.length > 3 ? ` 외 ${failed.length - 3}건` : ""
        }`,
        { duration: 15000 }
      );
      console.error("[이미지 교체] 실패 목록:\n" + failed.join("\n"));
    }
  }

  if (targets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-4 text-xs text-gray-500">
        교체할 이미지형 페이지가 없습니다. 페이지를 먼저 추가하세요.
      </p>
    );
  }

  // ── 확인 단계 ──
  if (staged) {
    const extra = staged.length - targets.length;
    const count = Math.min(staged.length, targets.length);
    const preview = staged.slice(0, count);

    return (
      <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            이미지 교체 확인 — 파일 {staged.length}개 / 이미지형 페이지 {targets.length}개
          </p>
          <p className="mt-1 text-xs text-amber-800">
            파일명 순서대로 아래와 같이 교체합니다. 페이지 순서·목차·기사 연동은 그대로
            유지되고 이미지만 바뀝니다.
          </p>
          {extra !== 0 && (
            <p className="mt-2 text-xs font-semibold text-red-700">
              {extra > 0
                ? `⚠️ 파일이 ${extra}개 많습니다 — 뒤쪽 ${extra}개는 교체되지 않습니다(앞에서부터 ${count}개만).`
                : `⚠️ 파일이 ${-extra}개 부족합니다 — 뒤쪽 ${-extra}개 페이지는 이전 이미지가 그대로 남습니다.`}
            </p>
          )}
        </div>

        {/* 전체를 다 보여준다 — "앞 5개만 맞으면 나머지도 맞다"는 보장이 없고,
            중간에 한 파일이 빠지면 그 뒤가 전부 한 칸씩 밀린다. */}
        <div className="max-h-56 overflow-y-auto rounded border border-amber-200 bg-white">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2 py-1 text-left font-medium">페이지</th>
                <th className="px-2 py-1 text-left font-medium">올릴 파일</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((f, i) => (
                <tr key={f.name + i} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-gray-700">
                    {targets[i].pageNumber}쪽
                  </td>
                  <td className="truncate px-2 py-1 text-gray-600">{f.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} disabled={busy}>
            {busy ? `교체 중... (${progress.current}/${progress.total})` : `${count}개 교체 시작`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStaged(null)}
            disabled={busy}
          >
            취소
          </Button>
        </div>
      </div>
    );
  }

  // ── 드롭 단계 ──
  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        isDragActive ? "border-amber-500 bg-amber-50" : "border-amber-300 hover:border-amber-400"
      } ${busy ? "pointer-events-none opacity-50" : ""}`}
    >
      <input {...getInputProps()} />
      <p className="text-sm font-medium text-amber-900">기존 페이지 이미지 일괄 교체</p>
      <p className="mt-1 text-xs text-amber-800">
        {isDragActive
          ? "여기에 이미지를 놓으세요"
          : `이미지형 페이지 ${targets.length}개에 파일명 순서대로 덮어씁니다. 페이지를 새로 만들지 않습니다.`}
      </p>
      <p className="mt-1 text-[11px] text-amber-700/80">
        올리기 전에 매핑을 확인할 수 있습니다.
      </p>
    </div>
  );
}

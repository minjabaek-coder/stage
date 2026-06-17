"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useRouter } from "next/navigation";
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import { compressImage } from "@/lib/image-client";
import { toast } from "sonner";

export function PageUploadZone({ magazineId }: { magazineId: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const router = useRouter();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      setProgress({ current: 0, total: acceptedFiles.length });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < acceptedFiles.length; i++) {
        setProgress({ current: i + 1, total: acceptedFiles.length });

        try {
          const compressed = await compressImage(acceptedFiles[i]);
          const formData = new FormData();
          formData.append("files", compressed);

          const res = await fetch(
            `/api/admin/magazines/${magazineId}/pages`,
            { method: "POST", body: formData }
          );

          if (!res.ok) {
            let errorMsg = `HTTP ${res.status}`;
            try {
              const data = await res.json();
              if (data.error) errorMsg = data.error;
            } catch { /* response is not JSON */ }
            toast.error(`${acceptedFiles[i].name}: ${errorMsg}`);
            failCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "네트워크 오류";
          toast.error(`${acceptedFiles[i].name}: ${msg}`);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount}개 페이지가 추가되었습니다`);
        router.refresh();
      }
      if (failCount > 0 && successCount === 0) {
        toast.error("모든 파일 업로드에 실패했습니다");
      }

      setUploading(false);
      setProgress({ current: 0, total: 0 });
    },
    [magazineId, router]
  );

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
    accept: Object.fromEntries(
      ACCEPTED_IMAGE_TYPES.map((type) => [type, []])
    ),
    maxSize: MAX_FILE_SIZE,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-gray-300 hover:border-gray-400"
      } ${uploading ? "pointer-events-none opacity-50" : ""}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <p className="text-sm text-gray-500">
          업로드 중... ({progress.current}/{progress.total})
        </p>
      ) : isDragActive ? (
        <p className="text-sm text-primary">여기에 이미지를 놓으세요</p>
      ) : (
        <div>
          <p className="text-sm text-gray-500">
            이미지를 드래그하거나 클릭하여 업로드
          </p>
          <p className="mt-1 text-xs text-gray-400">
            JPG, PNG, WebP (자동 최적화 및 WebP 변환)
          </p>
        </div>
      )}
    </div>
  );
}

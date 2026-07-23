import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "./constants";
import { compressImage } from "./image-client";

// 매거진 미디어 라이브러리 이미지(클라이언트 DTO — createdAt은 ISO 문자열)
export type MagazineAssetDTO = {
  id: string;
  url: string;
  path: string;
  filename: string;
  createdAt: string;
  usedIn?: number[]; // 이 매거진에서 사용 중인 페이지 번호(뱃지용, 저장된 상태 기준)
};

// kind=html 미디어 라이브러리 업로드 — 검증·압축 후 매거진 assets 엔드포인트로.
export async function uploadMagazineAsset(
  magazineId: string,
  file: File
): Promise<MagazineAssetDTO> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("지원하지 않는 파일 형식입니다");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("파일이 너무 큽니다 (최대 20MB)");
  }
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);

  const res = await fetch(`/api/admin/magazines/${magazineId}/assets/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "업로드 실패");
  return data.asset as MagazineAssetDTO;
}

/**
 * Validate → compress → upload a single image to the blog upload endpoint,
 * returning the stored public URL. Shared by the rich-text editor (dialog /
 * drag / paste) and the blog post thumbnail picker so type/size validation and
 * client-side compression stay consistent across every entry point.
 *
 * Throws an Error with a Korean message on rejection or a failed response.
 */
export async function uploadBlogImage(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("지원하지 않는 파일 형식입니다");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("파일이 너무 큽니다 (최대 20MB)");
  }

  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed);

  const res = await fetch("/api/admin/blog/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "업로드 실패");
  return data.url as string;
}

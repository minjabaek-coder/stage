import path from "path";
import sharp from "sharp";
import {
  ACCEPTED_IMAGE_TYPES,
  MAGAZINE_IMAGE_MAX_WIDTH,
  BLOG_IMAGE_MAX_WIDTH,
  WEBP_QUALITY,
} from "./constants";
import { getSupabase, STORAGE_BUCKET, getPublicUrl } from "./supabase";

async function optimizeImage(buffer: Buffer, maxWidth: number): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

function validateImageType(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`지원하지 않는 파일 형식입니다: ${file.type}`);
  }
}

function generateFilename(file: File, forceExtension?: string): string {
  const timestamp = Date.now();
  const originalExt = path.extname(file.name) || ".jpg";
  const ext = forceExtension || originalExt;
  const baseName = path.basename(file.name, originalExt);
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${timestamp}-${safeName}${ext}`;
}

export async function saveUploadedFile(
  file: File,
  magazineId: string,
  pageNumber?: number
): Promise<string> {
  validateImageType(file);

  const filename = pageNumber != null
    ? `${pageNumber}.webp`
    : generateFilename(file, ".webp");
  const storagePath = `magazines/${magazineId}/pages/${filename}`;

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let optimizedBuffer: Buffer;
  try {
    optimizedBuffer = await optimizeImage(rawBuffer, MAGAZINE_IMAGE_MAX_WIDTH);
  } catch {
    throw new Error("이미지 최적화에 실패했습니다. 다른 파일을 시도해주세요.");
  }

  const { error } = await getSupabase().storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, optimizedBuffer, {
      contentType: "image/webp",
    });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  return getPublicUrl(storagePath);
}

// kind=html 페이지 미디어 라이브러리용 업로드. 매거진 assets 경로에 저장하고
// 삭제에 쓸 storage path까지 함께 반환한다.
export async function saveMagazineAsset(
  file: File,
  magazineId: string
): Promise<{ url: string; path: string; filename: string }> {
  validateImageType(file);

  const filename = generateFilename(file, ".webp");
  const storagePath = `magazines/${magazineId}/assets/${filename}`;

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let optimizedBuffer: Buffer;
  try {
    optimizedBuffer = await optimizeImage(rawBuffer, MAGAZINE_IMAGE_MAX_WIDTH);
  } catch {
    throw new Error("이미지 최적화에 실패했습니다. 다른 파일을 시도해주세요.");
  }

  const { error } = await getSupabase().storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, optimizedBuffer, { contentType: "image/webp" });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  return { url: getPublicUrl(storagePath), path: storagePath, filename };
}

export async function saveBlogThumbnail(file: File): Promise<string> {
  validateImageType(file);

  const filename = generateFilename(file, ".webp");
  const storagePath = `blog/${filename}`;

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let optimizedBuffer: Buffer;
  try {
    optimizedBuffer = await optimizeImage(rawBuffer, BLOG_IMAGE_MAX_WIDTH);
  } catch {
    throw new Error("이미지 최적화에 실패했습니다. 다른 파일을 시도해주세요.");
  }

  const { error } = await getSupabase().storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, optimizedBuffer, {
      contentType: "image/webp",
    });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  return getPublicUrl(storagePath);
}

export async function deleteUploadedFile(imageUrl: string): Promise<void> {
  try {
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`);
    if (pathParts.length < 2) return;

    const storagePath = decodeURIComponent(pathParts[1]);
    const { error } = await getSupabase()
      .storage.from(STORAGE_BUCKET)
      .remove([storagePath]);
    if (error) {
      console.error(`[upload] Failed to delete ${storagePath}:`, error.message);
    }
  } catch (err) {
    // URL parsing failed; log so silent storage leaks are diagnosable
    console.error("[upload] deleteUploadedFile error:", err);
  }
}

import {
  CLIENT_COMPRESS_THRESHOLD,
  CLIENT_COMPRESS_MAX_WIDTH,
  CLIENT_COMPRESS_QUALITY,
} from "./constants";

// Lower bounds for the best-effort loop so we never degrade an image into
// uselessness while chasing the size target.
const MIN_QUALITY = 0.4;
const MIN_WIDTH = 800;
const WIDTH_STEP = 0.85; // shrink width by 15% per round once quality bottoms out

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
}

function drawToBlob(
  img: HTMLImageElement,
  width: number,
  quality: number
): Promise<Blob | null> {
  const height = Math.round((img.height * width) / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToBlob(canvas, quality);
}

/**
 * Browser-only image downscale/compress used before upload.
 *
 * Large originals (high-res scans, phone photos, long strips) are resized and
 * re-encoded as JPEG so we never push a body larger than the Vercel request
 * limit. Files already under the threshold are returned untouched.
 *
 * Best-effort loop: resize to CLIENT_COMPRESS_MAX_WIDTH, then if the result is
 * still over the threshold, first lower JPEG quality (down to MIN_QUALITY),
 * then progressively shrink the width (down to MIN_WIDTH). Returns as soon as
 * the encoded blob fits, or the smallest blob it managed to produce. On any
 * failure (no canvas ctx, decode error) the original file is returned — the
 * server-side size check remains the hard guard.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size <= CLIENT_COMPRESS_THRESHOLD) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);

    const toFile = (blob: Blob) => {
      const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], renamed, { type: "image/jpeg" });
    };

    img.onload = async () => {
      try {
        let width = Math.min(img.width, CLIENT_COMPRESS_MAX_WIDTH);
        let best: Blob | null = null;

        // Round 1+: hold width, ramp quality down; then shrink width and repeat.
        while (width >= MIN_WIDTH) {
          for (
            let quality = CLIENT_COMPRESS_QUALITY;
            quality >= MIN_QUALITY;
            quality -= 0.15
          ) {
            const blob = await drawToBlob(img, width, quality);
            if (!blob) {
              cleanup();
              resolve(file);
              return;
            }
            if (!best || blob.size < best.size) best = blob;
            if (blob.size <= CLIENT_COMPRESS_THRESHOLD) {
              cleanup();
              resolve(toFile(blob));
              return;
            }
          }
          width = Math.round(width * WIDTH_STEP);
        }

        // Couldn't reach the target; return the smallest we produced (server
        // still validates against MAX_FILE_SIZE), or fall back to the original.
        cleanup();
        resolve(best ? toFile(best) : file);
      } catch {
        cleanup();
        resolve(file);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(file);
    };

    img.src = objectUrl;
  });
}

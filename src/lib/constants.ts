export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Server-side optimization (sharp → WebP)
export const MAGAZINE_IMAGE_MAX_WIDTH = 1200;
export const BLOG_IMAGE_MAX_WIDTH = 1600;
export const WEBP_QUALITY = 85;

// Client-side pre-upload compression (canvas).
// Only triggers when a file exceeds the threshold; resizes to a cap that is
// at or above the server target so the server still controls the final size
// while we avoid uploading needlessly large originals.
export const CLIENT_COMPRESS_THRESHOLD = 4 * 1024 * 1024; // 4MB (Vercel Hobby body limit ≈ 4.5MB)
export const CLIENT_COMPRESS_MAX_WIDTH = 1920;
export const CLIENT_COMPRESS_QUALITY = 0.85;

export const MAGAZINES_PER_CAROUSEL = 5;
export const LATEST_BLOG_POSTS_COUNT = 3;

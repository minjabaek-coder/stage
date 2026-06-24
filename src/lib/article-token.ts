import { randomBytes, createHash } from "node:crypto";

// 기고자 무계정 편집 토큰 — 평문은 발급 시 1회만 노출, DB엔 sha256 해시만 저장.
export function generateEditToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url"); // URL-safe, 추측 불가
  return { token, hash: hashEditToken(token) };
}

export function hashEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

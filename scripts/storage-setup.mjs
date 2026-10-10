#!/usr/bin/env node
// Supabase Storage 버킷을 코드가 기대하는 상태로 만든다 (roadmap DR-B).
//
// 왜 스크립트인가: 2026-10-10 프로젝트 소멸 사고로 버킷을 **처음부터 다시 만들어야**
// 했다. 대시보드에서 손으로 만들면 "public이어야 한다" 같은 전제를 놓치기 쉽고,
// 다음에 같은 일이 생기면 또 기억에 의존해야 한다.
//
// 공개 버킷이어야 한다 — `src/lib/supabase.ts`의 `getPublicUrl()`이 서명 없는 공개
// URL을 만들고, 그 URL이 DB(`MagazinePage.imageUrl`·`Article.thumbnailUrl`·기사 본문
// HTML·구성형 layout JSON)에 그대로 저장된다.
//
// 사용: node scripts/storage-setup.mjs [--yes]
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const BUCKET = "stage_storage"; // src/lib/supabase.ts STORAGE_BUCKET와 같아야 한다
const YES = process.argv.includes("--yes");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\n✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local).");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`프로젝트: ${url}`);
console.log(`버킷:     ${BUCKET}\n`);

const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error(`\n✗ 버킷 목록을 읽을 수 없습니다: ${listErr.message}`);
  process.exit(1);
}

const existing = buckets.find((b) => b.name === BUCKET);

if (existing) {
  console.log(`이미 있습니다 — public=${existing.public}`);
  if (existing.public) {
    console.log("✓ 설정이 올바릅니다. 할 일 없음.");
    process.exit(0);
  }
  if (!YES) {
    console.log("\n⚠️ public이 아닙니다. 공개 URL이 404가 됩니다. --yes로 고치세요.");
    process.exit(1);
  }
  const { error } = await supabase.storage.updateBucket(BUCKET, { public: true });
  if (error) {
    console.error(`\n✗ 공개 전환 실패: ${error.message}`);
    process.exit(1);
  }
  console.log("✓ public으로 전환했습니다.");
  process.exit(0);
}

if (!YES) {
  console.log("버킷이 없습니다. 만들려면 --yes를 붙이세요.");
  process.exit(0);
}

const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
if (createErr) {
  console.error(`\n✗ 생성 실패: ${createErr.message}`);
  process.exit(1);
}
console.log("✓ 공개 버킷을 만들었습니다.");

// 실제로 올리고 읽히는지 확인한다 — "만들었다"는 응답만으로는 공개 URL이 동작하는지
// 알 수 없다(정책이 따로 걸려 있을 수 있다).
const probePath = `_healthcheck/${Date.now()}.txt`;
const { error: upErr } = await supabase.storage
  .from(BUCKET)
  .upload(probePath, Buffer.from("ok"), { contentType: "text/plain" });
if (upErr) {
  console.error(`\n✗ 업로드 확인 실패: ${upErr.message}`);
  process.exit(1);
}
const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(probePath);
const res = await fetch(pub.publicUrl);
const body = res.ok ? await res.text() : "";
await supabase.storage.from(BUCKET).remove([probePath]);

if (!res.ok || body !== "ok") {
  console.error(`\n✗ 공개 URL이 동작하지 않습니다 (HTTP ${res.status}). 버킷 정책을 확인하세요.`);
  process.exit(1);
}
console.log("✓ 업로드 → 공개 URL 읽기 확인 완료.");

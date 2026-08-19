#!/usr/bin/env node
// 운영 DB 논리 백업 (roadmap S0-1b).
//
// 왜 직접 만드나: ①Supabase Free plan에는 project backup이 없다 — 이 덤프가 **유일한
// 복구 수단**이다. ②`pg_dump`가 이 환경에 설치돼 있지 않다.
//
// 스키마는 마이그레이션 파일이 정본이므로 **데이터만** 뜬다. 복구 절차는
// `migrate deploy`로 스키마를 세운 뒤 이 덤프를 넣는 순서다(docs/db/restore.md).
//
// 파생 데이터(임베딩 청크)는 기본 제외한다 — 재색인으로 언제든 복원되고, 청크당 1024개
// 실수라 덤프가 급격히 커진다. 필요하면 --with-derived.
//
// 사용: node scripts/db-backup.mjs [--with-derived] [--out backups]
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const argv = process.argv.slice(2);
const WITH_DERIVED = argv.includes("--with-derived");
const outRoot = (() => {
  const i = argv.indexOf("--out");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : "backups";
})();

// 재색인으로 복원 가능한 파생 테이블(= 잃어도 복구 가능). 기본 제외.
const DERIVED = new Set([
  "ContentChunk",
  "ArticleChunk",
  "BlogPostChunk",
  "MagazineArticleChunk",
]);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL이 없습니다 (.env.local 확인).");
  process.exit(1);
}

// 2026-08-19T09:20:53.123Z → 20260819092053 (8자리 날짜 + 6자리 시각).
// slice 길이를 잘못 잡으면 밀리초 앞의 마침표가 딸려와 디렉토리 이름이 "...53." 이 된다
// (Windows는 후행 마침표를 떼지만 Linux/CI에서는 그대로 남는다).
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const outDir = path.join(outRoot, stamp);
fs.mkdirSync(outDir, { recursive: true });

const client = new pg.Client({ connectionString: url });
await client.connect();

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
})();

const { rows: tableRows } = await client.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`,
);
const all = tableRows.map((r) => r.table_name);
const targets = all.filter((t) => WITH_DERIVED || !DERIVED.has(t));
const skipped = all.filter((t) => !targets.includes(t));

console.log(`백업 대상 ${targets.length}개 테이블 → ${outDir}`);
if (skipped.length) console.log(`제외(파생·재색인 가능): ${skipped.join(", ")}`);

const manifest = {
  takenAt: new Date().toISOString(),
  host,
  withDerived: WITH_DERIVED,
  skipped,
  tables: {},
};
let totalRows = 0;
let totalBytes = 0;

for (const table of targets) {
  const { rows } = await client.query(`SELECT * FROM "${table}"`);
  const file = path.join(outDir, `${table}.ndjson`);
  // NDJSON — 한 줄 = 한 행. 부분 복구·grep이 쉽고 큰 테이블에서도 스트리밍 가능.
  const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  fs.writeFileSync(file, body, "utf8");

  const bytes = Buffer.byteLength(body, "utf8");
  manifest.tables[table] = { rows: rows.length, bytes };
  totalRows += rows.length;
  totalBytes += bytes;
  console.log(
    `  ${table.padEnd(24)} ${String(rows.length).padStart(6)}행  ${(bytes / 1024).toFixed(0)}KB`,
  );
}

// 마이그레이션 장부 상태도 남긴다 — 복구 시 "어느 스키마 시점의 데이터인가"를 알아야 한다.
const { rows: mig } = await client.query(
  `SELECT migration_name, finished_at FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`,
);
manifest.lastMigration = mig[0]?.migration_name ?? null;

await client.end();

// 검증: 쓴 파일을 되읽어 행 수가 일치하는지 확인(부분 기록·인코딩 사고 방지).
let verifyFail = 0;
for (const [table, info] of Object.entries(manifest.tables)) {
  const text = fs.readFileSync(path.join(outDir, `${table}.ndjson`), "utf8");
  const lines = text ? text.split("\n").filter(Boolean) : [];
  let parsed = 0;
  for (const l of lines) {
    try {
      JSON.parse(l);
      parsed++;
    } catch {
      /* 아래에서 불일치로 잡힘 */
    }
  }
  if (parsed !== info.rows) {
    console.error(`  ✗ ${table}: 기록 ${info.rows}행 ≠ 재확인 ${parsed}행`);
    verifyFail++;
  }
}

manifest.verified = verifyFail === 0;
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);

console.log(
  `\n총 ${totalRows.toLocaleString()}행 · ${(totalBytes / 1024 / 1024).toFixed(2)}MB` +
    `  (마지막 마이그레이션: ${manifest.lastMigration})`,
);
if (verifyFail) {
  console.error(`검증 실패 ${verifyFail}개 테이블 — 백업을 신뢰하지 마세요.`);
  process.exit(1);
}
console.log(`검증 완료 — ${outDir}`);

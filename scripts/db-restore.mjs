#!/usr/bin/env node
// 백업 NDJSON → DB 복원 (roadmap S0-1c / DR-B1).
//
// `db-backup.mjs`의 역방향. 2026-10-10 Supabase 프로젝트 소멸 사고로 "수기 절차"가
// 더 이상 현실적이지 않아졌다 — 3,355행을 손으로 INSERT할 수는 없다.
//
// 스키마는 넣지 않는다. 순서는 **마이그레이션으로 스키마 → 이 스크립트로 데이터**다
// (docs/db/restore.md). 스키마 정본은 prisma/migrations/.
//
// 설계 원칙
//  · **멱등** — `ON CONFLICT DO NOTHING`. 중간에 끊겨도 다시 돌리면 이어서 채운다.
//  · **덮어쓰지 않는다** — 기존 행을 UPDATE하지 않는다. 복원은 "채우기"이고,
//    덮어쓰기는 또 다른 사고다. 기본적으로 **비어 있지 않은 테이블이 있으면 중단**한다.
//  · **스키마를 추측하지 않는다** — 컬럼 목록·타입·NOT NULL·기본값·FK 순서를 모두
//    대상 DB의 information_schema에서 읽는다. 백업이 현재 스키마보다 낡아도
//    (컬럼 추가·삭제) 교집합으로 동작한다.
//
// 사용:
//   node scripts/db-restore.mjs backups/<stamp> --dry-run
//   node scripts/db-restore.mjs backups/<stamp> --yes
//   node scripts/db-restore.mjs backups/<stamp> --yes --only Magazine,MagazinePage
//   node scripts/db-restore.mjs backups/<stamp> --yes --force      # 비어있지 않아도 이어서 채움
//   node scripts/db-restore.mjs backups/<stamp> --yes --truncate   # 비우고 처음부터(clean restore)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const YES = argv.includes("--yes");
const FORCE = argv.includes("--force");
const TRUNCATE = argv.includes("--truncate");
const backupDir = argv.find((a) => !a.startsWith("--"));
const ONLY = (() => {
  const i = argv.indexOf("--only");
  return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(",").map((s) => s.trim())) : null;
})();

// 마이그레이션 장부는 복원하지 않는다. 새 DB의 장부는 `migrate deploy`가 쓴 것이
// 정본이고, 낡은 장부를 밀어넣으면 이후 마이그레이션 판정이 틀어진다.
const NEVER_RESTORE = new Set(["_prisma_migrations"]);

function die(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

if (!backupDir) die("백업 디렉토리를 지정하세요. 예: node scripts/db-restore.mjs backups/20260819111211 --dry-run");
if (!fs.existsSync(backupDir)) die(`백업 디렉토리가 없습니다: ${backupDir}`);

const manifestPath = path.join(backupDir, "manifest.json");
if (!fs.existsSync(manifestPath)) die(`manifest.json이 없습니다: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) die("DATABASE_URL이 없습니다 (.env.local 확인).");
const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
})();

console.log(`백업:   ${backupDir}`);
console.log(`  시점: ${manifest.takenAt}  (원본 호스트 ${manifest.host})`);
console.log(`  스키마 시점: ${manifest.lastMigration}`);
console.log(`  검증: ${manifest.verified ? "통과" : "실패 ⚠️"}`);
console.log(`대상 DB: ${host}`);
console.log(DRY ? "모드:   DRY-RUN (쓰지 않음)\n" : "모드:   실제 복원\n");

if (!manifest.verified && !FORCE) {
  die("이 백업은 검증에 실패한 백업입니다(manifest.verified=false). 그래도 쓰려면 --force.");
}
if (!DRY && !YES) {
  die(`실제로 쓰려면 --yes를 붙이세요. 대상: ${host}\n   먼저 --dry-run으로 확인하는 것을 권합니다.`);
}

// 가장 흔한 실패는 "환경변수를 아직 새 프로젝트로 바꾸지 않음"이다. pg의 raw 스택을
// 그대로 토하면 그걸 알아보기 어렵다.
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
} catch (e) {
  die(
    `대상 DB에 접속할 수 없습니다: ${host}\n` +
      `   ${e.code ? `[${e.code}] ` : ""}${e.message}\n` +
      `   .env.local의 DATABASE_URL이 새 Supabase 프로젝트를 가리키는지 확인하세요.`
  );
}

// ── 대상 DB의 스키마를 읽는다 (추측하지 않는다) ──────────────────────────────
const { rows: colRows } = await client.query(
  `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position`
);
if (colRows.length === 0) {
  await client.end();
  die("대상 DB의 public 스키마가 비어 있습니다. 먼저 `npx prisma migrate deploy`로 스키마를 세우세요.");
}

const schema = new Map(); // table -> Map(column -> meta)
for (const r of colRows) {
  if (!schema.has(r.table_name)) schema.set(r.table_name, new Map());
  schema.get(r.table_name).set(r.column_name, {
    // jsonb/json은 JS 객체·배열을 **문자열로 직렬화해서** 넣어야 한다. 그냥 넘기면
    // node-postgres가 JS 배열을 PostgreSQL 배열 리터럴로 바꿔 jsonb 입력을 깨뜨린다
    // (Magazine.sourceSections·MagazinePage.layout이 바로 이 경우).
    isJson: r.data_type === "jsonb" || r.data_type === "json",
    isArray: r.data_type === "ARRAY",
    // 시각 컬럼은 **반드시 Date 객체로** 넣는다. ISO 문자열("...Z")을 그대로 넣으면
    // `timestamp without time zone`(Prisma 기본)에서 PostgreSQL이 오프셋을 **버리고**
    // 벽시계 값만 저장한다. 그런데 백업 JSON은 node-postgres가 그 컬럼을 **로컬 시간**
    // 으로 읽어 만든 값이라, 문자열로 되넣으면 로컬 오프셋만큼 어긋난다.
    //   저장 18:16:18 → 백업 JSON "09:16:18Z"(KST로 읽힘) → 문자열 복원 09:16:18  ✗ -9h
    //   저장 18:16:18 → 백업 JSON "09:16:18Z"            → Date 복원    18:16:18  ✓
    // Date를 넘기면 pg가 로컬 표현 + 오프셋으로 직렬화하므로 왕복이 **정확히 대칭**이 된다.
    // (2026-10-10 실측: 이 처리를 빼고 복원했을 때 3,351행 전부 9시간 어긋났다.
    //  행 수는 완벽히 일치했으므로 개수 대조만으로는 절대 잡히지 않는다.)
    isTemporal: r.data_type.startsWith("timestamp") || r.data_type === "date",
    nullable: r.is_nullable === "YES",
    hasDefault: r.column_default !== null,
  });
}

// ── FK 위상 순서 (부모 먼저) ────────────────────────────────────────────────
const { rows: fkRows } = await client.query(
  `SELECT tc.table_name AS child, ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'`
);

function topoSort(tables, edges) {
  const set = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of edges) {
    // 자기참조는 순서를 만들 수 없고(같은 테이블 안의 문제) 무시해도 안전하다.
    if (child !== parent && set.has(child) && set.has(parent)) deps.get(child).add(parent);
  }
  const out = [];
  const done = new Set();
  // 안정적인 순서를 위해 알파벳 순으로 훑는다(실행마다 순서가 바뀌면 재현이 어렵다).
  const pending = [...tables].sort();
  let guard = pending.length + 1;
  while (pending.length && guard-- > 0) {
    const ready = pending.filter((t) => [...deps.get(t)].every((p) => done.has(p)));
    if (ready.length === 0) break; // 순환 — 아래에서 처리
    for (const t of ready) {
      out.push(t);
      done.add(t);
    }
    pending.splice(0, pending.length, ...pending.filter((t) => !done.has(t)));
  }
  return { order: out, unresolved: pending };
}

// 복원 대상 = 백업에 파일이 있고 + 대상 DB에 테이블이 있는 것의 교집합
const backupTables = fs
  .readdirSync(backupDir)
  .filter((f) => f.endsWith(".ndjson"))
  .map((f) => f.replace(/\.ndjson$/, ""))
  .filter((t) => !NEVER_RESTORE.has(t))
  .filter((t) => !ONLY || ONLY.has(t));

const missingInDb = backupTables.filter((t) => !schema.has(t));
const targets = backupTables.filter((t) => schema.has(t));
if (missingInDb.length) {
  console.log(`⚠️ 대상 DB에 없는 테이블은 건너뜁니다: ${missingInDb.join(", ")}`);
}

const { order, unresolved } = topoSort(targets, fkRows);
if (unresolved.length) {
  console.log(`⚠️ FK 순환으로 순서를 정하지 못한 테이블을 마지막에 둡니다: ${unresolved.join(", ")}`);
  order.push(...unresolved);
}

// ── 현재 행 수 파악 ─────────────────────────────────────────────────────────
const currentCounts = new Map();
for (const t of order) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${t}"`);
  currentCounts.set(t, rows[0].n);
}
const existing = order.filter((t) => currentCounts.get(t) > 0);

// ── --truncate: 복원 전에 비운다 (clean restore) ─────────────────────────────
if (TRUNCATE) {
  // **백업보다 많은 행을 지우지 않는다.** 복원으로 되돌릴 수 없는 삭제를 막는 안전장치다.
  const wouldLose = order.filter((t) => {
    const have = currentCounts.get(t);
    const backup = readNdjson(t).length;
    return have > backup;
  });
  if (wouldLose.length && !FORCE) {
    await client.end();
    die(
      `다음 테이블은 현재 행이 백업보다 많습니다 — 비우면 되돌릴 수 없는 손실이 생깁니다:\n` +
        wouldLose
          .map((t) => `     ${t}: 현재 ${currentCounts.get(t)}행 > 백업 ${readNdjson(t).length}행`)
          .join("\n") +
        `\n   정말 지우려면 --force. 그 전에 \`npm run db:backup\`으로 현재 상태를 먼저 뜨세요.`
    );
  }

  if (existing.length === 0) {
    console.log("--truncate — 비울 행이 없습니다(이미 빈 테이블).\n");
  } else {
    console.log(
      `--truncate — 먼저 비웁니다: ${existing.map((t) => `${t}(${currentCounts.get(t)}행)`).join(", ")}`
    );
    if (DRY) {
      console.log("   (DRY-RUN이라 실제로 지우지 않습니다)\n");
    } else {
      // 자식 먼저(FK 역순). TRUNCATE CASCADE는 **대상 밖 테이블까지** 비울 수 있어 쓰지 않는다.
      for (const t of [...order].reverse()) {
        if (currentCounts.get(t) > 0) await client.query(`DELETE FROM "${t}"`);
      }
      console.log("   비웠습니다.\n");
      for (const t of order) currentCounts.set(t, 0);
    }
  }
} else if (existing.length) {
  console.log(
    `\n⚠️ 이미 데이터가 있는 테이블: ${existing.map((t) => `${t}(${currentCounts.get(t)}행)`).join(", ")}`
  );
  if (!FORCE) {
    await client.end();
    die(
      "복원은 빈 DB를 전제로 합니다. 기존 행을 덮어쓰지 않으려면 여기서 멈추는 것이 맞습니다.\n" +
        "   · 이어서 없는 행만 채우려면  --force\n" +
        "   · 비우고 처음부터 넣으려면   --truncate"
    );
  }
  console.log("   --force — 기존 행은 보존하고 없는 행만 채웁니다.\n");
}

// 스키마 시점 경고 (restore.md §2.1)
const { rows: migRows } = await client.query(
  `SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`
);
const dbMigration = migRows[0]?.migration_name ?? null;
if (dbMigration && manifest.lastMigration && dbMigration < manifest.lastMigration) {
  console.log(
    `⚠️ 대상 DB 스키마(${dbMigration})가 백업 시점(${manifest.lastMigration})보다 **뒤처져** 있습니다.\n` +
      `   먼저 \`npx prisma migrate deploy\`를 실행하세요.\n`
  );
}

// ── 값 변환 ─────────────────────────────────────────────────────────────────
// 백업 JSON의 값을 pg 파라미터로. 컬럼 타입마다 "그냥 넘기면 깨지는" 지점이 있다.
function toParam(meta, v, where) {
  if (v === null || v === undefined) return null;
  if (meta.isJson && typeof v !== "string") return JSON.stringify(v);
  if (meta.isTemporal && typeof v === "string") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) die(`${where}: 날짜로 해석할 수 없는 값 — ${v}`);
    return d;
  }
  return v;
}

// 되읽은 값을 백업 JSON과 같은 모양으로 정규화해 비교한다.
function normalize(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return v.toString("base64");
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "bigint") return v.toString();
  return v;
}

// ── 복원 ────────────────────────────────────────────────────────────────────
function readNdjson(table) {
  const text = fs.readFileSync(path.join(backupDir, `${table}.ndjson`), "utf8");
  if (!text.trim()) return [];
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const report = [];
let totalInserted = 0;

for (const table of order) {
  const rows = readNdjson(table);
  const cols = schema.get(table);
  if (rows.length === 0) {
    report.push({ table, backup: 0, inserted: 0, final: 0, note: "" });
    continue;
  }

  // 백업과 현재 스키마의 교집합. 백업에만 있는 컬럼(삭제됨)은 버리고,
  // 현재 스키마에만 있는 컬럼(추가됨)은 기본값/NULL에 맡긴다.
  const backupCols = Object.keys(rows[0]);
  const useCols = backupCols.filter((c) => cols.has(c));
  const droppedCols = backupCols.filter((c) => !cols.has(c));

  // NOT NULL + 기본값이 있는 컬럼에 백업값이 null이면 그 컬럼을 빼고 기본값에 맡긴다
  // (실측: User.interests가 백업에 null로 들어 있다).
  const defaultedWhenNull = new Set(
    useCols.filter((c) => !cols.get(c).nullable && cols.get(c).hasDefault)
  );

  let inserted = 0;
  // 파라미터 상한(65535)에 걸리지 않게 나눠 넣는다.
  const perBatch = Math.max(1, Math.floor(60000 / Math.max(1, useCols.length)));

  for (let i = 0; i < rows.length; i += perBatch) {
    const chunk = rows.slice(i, i + perBatch);

    // null이 빠지는 컬럼 조합이 행마다 다를 수 있으므로, 조합별로 묶어서 넣는다.
    const groups = new Map();
    for (const row of chunk) {
      const colsForRow = useCols.filter(
        (c) => !(row[c] === null && defaultedWhenNull.has(c))
      );
      const key = colsForRow.join(",");
      if (!groups.has(key)) groups.set(key, { cols: colsForRow, rows: [] });
      groups.get(key).rows.push(row);
    }

    for (const { cols: groupCols, rows: groupRows } of groups.values()) {
      const values = [];
      const tuples = groupRows.map((row) => {
        const ph = groupCols.map((c) => {
          values.push(toParam(cols.get(c), row[c], `${table}.${c}`));
          return `$${values.length}`;
        });
        return `(${ph.join(",")})`;
      });

      const sql =
        `INSERT INTO "${table}" (${groupCols.map((c) => `"${c}"`).join(",")}) ` +
        `VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`;

      if (DRY) {
        inserted += groupRows.length;
        continue;
      }
      const res = await client.query(sql, values);
      inserted += res.rowCount ?? 0;
    }
  }

  const finalCount = DRY
    ? null
    : (await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;

  report.push({
    table,
    backup: rows.length,
    inserted,
    final: finalCount,
    note: droppedCols.length ? `백업에만 있던 컬럼 무시: ${droppedCols.join(",")}` : "",
  });
  totalInserted += inserted;
  console.log(
    `  ${table.padEnd(24)} 백업 ${String(rows.length).padStart(5)}행 → ${DRY ? "넣을 예정" : "삽입"} ${String(inserted).padStart(5)}행`
  );
}

// ── 값 대조 ─────────────────────────────────────────────────────────────────
// **개수 대조만으로는 부족하다.** 2026-10-10 실측: 시각 컬럼을 문자열로 넣어 3,351행
// 전부 9시간 어긋났는데 행 수는 모든 테이블에서 정확히 일치했다. 그래서 되읽어
// 백업과 값을 비교한다 — 복원이 "들어갔다"가 아니라 "같다"를 확인해야 한다.
let valueMismatch = 0;
if (!DRY) {
  const { rows: pkRows } = await client.query(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
      ORDER BY kcu.ordinal_position`
  );
  const pks = new Map();
  for (const r of pkRows) {
    if (!pks.has(r.table_name)) pks.set(r.table_name, []);
    pks.get(r.table_name).push(r.column_name);
  }

  console.log("\n값 대조 (되읽어 백업과 비교)");
  for (const r of report) {
    if (r.backup === 0) continue;
    const pk = pks.get(r.table);
    if (!pk || pk.length === 0) {
      console.log(`  ${r.table.padEnd(24)} 기본키가 없어 건너뜀`);
      continue;
    }
    const cols = schema.get(r.table);
    const backupRows = readNdjson(r.table);
    const useCols = Object.keys(backupRows[0]).filter((c) => cols.has(c));

    const { rows: dbRows } = await client.query(
      `SELECT ${useCols.map((c) => `"${c}"`).join(",")} FROM "${r.table}"`
    );
    const keyOf = (row) => pk.map((k) => String(row[k])).join(" ");
    const dbByKey = new Map(dbRows.map((row) => [keyOf(row), row]));

    const badCols = new Map(); // column -> 불일치 건수
    let missing = 0;
    for (const b of backupRows) {
      const d = dbByKey.get(keyOf(b));
      if (!d) {
        missing++;
        continue;
      }
      for (const c of useCols) {
        // NOT NULL + 기본값 컬럼에 백업값이 null이면 기본값이 들어간 것이 정상이다.
        if (b[c] === null && !cols.get(c).nullable && cols.get(c).hasDefault) continue;
        if (normalize(d[c]) !== normalize(b[c])) {
          badCols.set(c, (badCols.get(c) ?? 0) + 1);
        }
      }
    }

    if (missing === 0 && badCols.size === 0) {
      console.log(`  ✓ ${r.table.padEnd(22)} ${r.backup}행 전부 일치`);
    } else {
      valueMismatch++;
      const detail = [...badCols.entries()].map(([c, n]) => `${c}×${n}`).join(", ");
      console.log(
        `  ✗ ${r.table.padEnd(22)} 누락 ${missing}행` + (detail ? ` · 값 불일치 ${detail}` : "")
      );
      // 첫 불일치를 하나 보여준다 — 어떤 식으로 틀렸는지 알아야 고칠 수 있다.
      for (const col of badCols.keys()) {
        const b = backupRows.find((x) => {
          const d = dbByKey.get(keyOf(x));
          return d && normalize(d[col]) !== normalize(x[col]);
        });
        if (b) {
          const d = dbByKey.get(keyOf(b));
          console.log(`      예) ${col}: 백업 ${normalize(b[col])} ≠ DB ${normalize(d[col])}`);
        }
        break;
      }
    }
  }
}

// ── 개수 대조 ───────────────────────────────────────────────────────────────
console.log(`\n${"테이블".padEnd(24)} ${"백업".padStart(6)} ${"삽입".padStart(6)} ${"현재".padStart(6)}`);
let mismatch = 0;
for (const r of report) {
  const final = r.final === null ? "-" : String(r.final);
  const ok = DRY || r.final >= r.backup;
  if (!ok) mismatch++;
  console.log(
    `${ok ? " " : "✗"}${r.table.padEnd(23)} ${String(r.backup).padStart(6)} ${String(r.inserted).padStart(6)} ${final.padStart(6)}` +
      (r.note ? `  ${r.note}` : "")
  );
}

await client.end();

console.log(
  `\n${DRY ? "DRY-RUN" : "복원"} 완료 — ${totalInserted.toLocaleString()}행 ${DRY ? "예정" : "삽입"}`
);

if (mismatch) {
  console.error(
    `\n✗ ${mismatch}개 테이블이 백업 행 수에 미달합니다. FK 위반이나 제약 충돌로 일부 행이 빠졌을 수 있습니다.`
  );
  process.exit(1);
}
if (valueMismatch) {
  console.error(
    `\n✗ ${valueMismatch}개 테이블의 **값**이 백업과 다릅니다. 행 수가 맞아도 복원된 것이 아닙니다.`
  );
  process.exit(1);
}

if (!DRY) {
  console.log(
    [
      "",
      "다음 할 일 (이 스크립트가 못 해주는 것):",
      "  1) ⚠️ 관리자 로그인 — 구 프로젝트의 Supabase Auth 계정은 함께 사라졌습니다.",
      "     복원된 User 행의 authId는 **없어진 auth 계정**을 가리킵니다. 새로 가입하면",
      "     email unique 충돌로 User 행이 만들어지지 않아 **영구 비로그인 상태**가 됩니다",
      "     (signUp은 성공하고 syncUserToDB 실패만 로그에 남습니다).",
      "     → Supabase 대시보드 Authentication에서 사용자를 만든 뒤, 그 UUID로 다시 연결:",
      "        node scripts/relink-auth.mjs <email> <새 auth UUID>",
      "  2) 임베딩 재색인 — ContentChunk는 백업 대상이 아닙니다(docs/db/restore.md §2.4).",
      "  3) Storage 파일 — 백업에 없습니다. 이미지 URL은 사라진 버킷을 가리킵니다.",
    ].join("\n")
  );
}

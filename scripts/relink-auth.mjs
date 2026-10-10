#!/usr/bin/env node
// 복원된 User 행을 **새 Supabase Auth 계정**에 다시 연결한다 (DR-B/DR-C).
//
// 왜 필요한가: Supabase 프로젝트가 사라지면 DB와 함께 **Auth 계정도 사라진다**.
// 백업으로 되살린 `User` 행의 `authId`는 존재하지 않는 계정을 가리키고, 같은 이메일로
// 새로 가입하면 `syncUserToDB`의 create가 **email unique 제약에 걸린다**. 그 실패는
// try/catch로 삼켜지므로(auth-actions.ts) 가입은 성공한 듯 보이고 — 사용자는
// **영구 비로그인 상태**가 된다. getCurrentUser()가 authId로 찾기 때문이다.
//
// 이메일로 자동 연결하게 코드를 바꾸는 방법도 있지만 채택하지 않았다: 이메일 확인이
// 꺼져 있으면 **남이 그 이메일로 가입해 관리자 행을 가져갈 수 있다.** 복구는 일회성
// 작업이므로 소유자가 명시적으로 수행하는 편이 안전하다.
//
// 선행: Supabase 대시보드 → Authentication → Users → Add user 로 계정을 만든다
//       (또는 앱에서 회원가입). 그 사용자의 UUID를 인자로 넘긴다.
//
// 사용: node scripts/relink-auth.mjs <email> <새 auth UUID> [--yes]
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const [email, authId, ...rest] = process.argv.slice(2);
const YES = rest.includes("--yes") || process.argv.includes("--yes");

function die(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

if (!email || !authId) {
  die("사용: node scripts/relink-auth.mjs <email> <새 auth UUID> [--yes]");
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authId)) {
  die(`auth UUID 형식이 아닙니다: ${authId}\n   Supabase 대시보드 Authentication → Users에서 복사하세요.`);
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) die("DATABASE_URL이 없습니다 (.env.local 확인).");

// 1) 그 UUID가 **실제로 존재하는 auth 계정**인지 먼저 본다. 오타난 UUID로 연결하면
//    아무도 로그인할 수 없는 행이 되고, 원인을 찾기 어렵다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (supabaseUrl && serviceKey) {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.getUserById(authId);
  if (error || !data?.user) {
    die(
      `Supabase Auth에 그 UUID의 사용자가 없습니다: ${authId}\n   ${error?.message ?? ""}`.trimEnd()
    );
  }
  if (data.user.email && data.user.email.toLowerCase() !== email.toLowerCase()) {
    die(
      `auth 계정의 이메일(${data.user.email})과 지정한 이메일(${email})이 다릅니다.\n` +
        `   다른 사람의 계정에 관리자 행을 붙이는 사고를 막기 위해 중단합니다.`
    );
  }
  console.log(`auth 계정 확인: ${data.user.email} (${authId})`);
} else {
  console.log(
    "⚠️ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없어 auth 계정 존재 확인을 건너뜁니다."
  );
}

const client = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
} catch (e) {
  die(`DB에 접속할 수 없습니다: ${e.code ? `[${e.code}] ` : ""}${e.message}`);
}

const { rows: targets } = await client.query(
  `SELECT id, email, role, tier, "authId" FROM "User" WHERE lower(email) = lower($1)`,
  [email]
);
if (targets.length === 0) {
  await client.end();
  die(`"${email}" 이메일을 가진 User 행이 없습니다. 복원이 끝났는지 확인하세요.`);
}
if (targets.length > 1) {
  await client.end();
  die(`"${email}" 이메일을 가진 User 행이 ${targets.length}개입니다. 수동 확인이 필요합니다.`);
}
const target = targets[0];

// 다른 행이 이미 그 authId를 쓰고 있으면(가입이 부분적으로 성공한 경우) 멈춘다.
const { rows: clash } = await client.query(
  `SELECT id, email FROM "User" WHERE "authId" = $1 AND id <> $2`,
  [authId, target.id]
);
if (clash.length) {
  await client.end();
  die(
    `그 authId를 이미 다른 User 행이 쓰고 있습니다: ${clash[0].email} (${clash[0].id}).\n` +
      `   중복 가입으로 생긴 행일 수 있습니다 — 어느 쪽을 남길지 먼저 정하세요.`
  );
}

console.log(
  `\n대상 User: ${target.email}  role=${target.role}  tier=${target.tier}\n` +
    `  authId: ${target.authId ?? "(없음)"} → ${authId}`
);

if (!YES) {
  await client.end();
  console.log("\n실제로 바꾸려면 --yes를 붙이세요.");
  process.exit(0);
}

const res = await client.query(
  `UPDATE "User" SET "authId" = $1, "updatedAt" = now() WHERE id = $2`,
  [authId, target.id]
);
await client.end();

console.log(`\n✓ ${res.rowCount}행 갱신 — 이제 이 계정으로 로그인하면 role=${target.role}로 인식됩니다.`);
if (target.role !== "admin") {
  console.log(
    `⚠️ 이 행의 role은 "${target.role}"입니다. 어드민이 필요하면 별도로 admin으로 바꿔야 합니다.`
  );
}

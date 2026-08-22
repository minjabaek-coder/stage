#!/usr/bin/env node
/**
 * 발행 전 콘텐츠가 **익명 방문자에게 새어 나가는지** 점검한다.
 *
 * 왜 만들었나: 2026-08-21에 "실린 곳" 배지가 매거진의 발행 상태를 보지 않아
 * 미발행 39호·테스트 999호의 호수와 매거진 id가 익명 화면에 그대로 노출됐다.
 * 운영에서 몇 세션째 살아 있었고 사용자가 우연히 발견했다. 사람이 매번 눈으로
 * 확인할 일이 아니라 기계가 볼 일이다.
 *
 * **왜 CI가 아니라 스크립트인가**: 무엇이 미발행인지 알려면 운영 DB를 봐야 하고,
 * 실제 노출을 보려면 배포된 사이트에 요청해야 한다. 둘 다 CI에 넣을 수 없다
 * (테스트 기준은 docs/worklog S1-12 — CI는 비밀값 없이 도는 순수 로직만).
 *
 * 사용법:
 *   npm run audit:gating                       # 운영(https://www.bon-stage.com)
 *   npm run audit:gating -- http://localhost:3000
 *
 * ⚠️ 반드시 **로그인하지 않은 상태**로 요청한다(쿠키를 보내지 않는다).
 *    브라우저로 보면 관리자 미리보기와 실제 노출을 구분할 수 없다.
 */
import pg from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const BASE = (process.argv[2] ?? "https://www.bon-stage.com").replace(/\/$/, "");
const TIMEOUT_MS = 30_000;

// 생성된 Prisma 클라이언트는 TypeScript라 Node가 직접 못 읽는다 →
// scripts/db-backup.mjs와 같은 방식으로 pg를 직접 쓴다.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

/** 공개 목록 화면 — 여기에 미발행 콘텐츠의 흔적이 있으면 안 된다. */
const PUBLIC_PAGES = ["/", "/articles", "/magazines", "/tickets"];

let failures = 0;
const note = (ok, msg) => {
  if (!ok) failures++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${msg}`);
};

async function get(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, { redirect: "manual", signal: ctrl.signal });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    return { status: 0, body: "", error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** 응답이 '없는 페이지'로 취급되는가.
 *  상태코드만 보면 안 된다 — 매거진 뷰어는 loading.tsx 때문에 200을 돌려주면서
 *  본문은 Not Found다(소프트-404, 백로그 BL-12). 내용까지 확인한다. */
function isNotFound({ status, body }) {
  if (status === 404) return true;
  return /<title>\s*Not Found\s*<\/title>/i.test(body);
}

async function main() {
  console.log(`발행 전 콘텐츠 노출 점검 — ${BASE}\n`);

  await db.connect();
  // pg 클라이언트 하나로 동시에 질의하면 안 된다(pg@9에서 제거될 동작) → 순차 실행.
  const q = async (sql) => (await db.query(sql)).rows;
  const magazines = await q(`SELECT id, "issueNumber", title, status FROM "Magazine" WHERE status <> 'published'`);
  const articles = await q(`SELECT slug, title, status FROM "Article" WHERE status <> 'published'`);
  const events = await q(`SELECT slug, title, status FROM "CultureEvent" WHERE status <> 'published'`);

  console.log(
    `대상: 매거진 ${magazines.length} · 기사 ${articles.length} · 문화예술 ${events.length}\n`,
  );

  // ① 직접 접근 — 익명은 볼 수 없어야 한다.
  console.log("[1] 미발행 콘텐츠 직접 접근");
  for (const m of magazines) {
    const r = await get(`/magazines/${m.id}`);
    note(isNotFound(r), `매거진 ${m.issueNumber}호(${m.status}) → ${r.status}`);
  }
  for (const a of articles) {
    const r = await get(`/articles/${a.slug}`);
    note(isNotFound(r), `기사 ${a.slug}(${a.status}) → ${r.status}`);
  }
  for (const e of events) {
    const r = await get(`/culture-events/${e.slug}`);
    note(isNotFound(r), `문화예술 ${e.slug}(${e.status}) → ${r.status}`);
  }

  // ② 공개 목록에 흔적이 남는가 — 제목·id·호수 라벨.
  //    "실린 곳" 결함이 정확히 이 갈래였다(본문은 못 봐도 호수와 id가 새어 나갔다).
  console.log("\n[2] 공개 목록에 미발행 콘텐츠 흔적");
  const needles = [
    ...magazines.flatMap((m) => [
      { label: `매거진 id ${m.id}`, text: m.id },
      { label: `${m.issueNumber}호 라벨`, text: `STAGE ${m.issueNumber}호` },
    ]),
    ...articles.map((a) => ({ label: `기사 slug ${a.slug}`, text: `/articles/${a.slug}` })),
    ...events.map((e) => ({ label: `문화예술 slug ${e.slug}`, text: `/culture-events/${e.slug}` })),
  ];

  for (const page of PUBLIC_PAGES) {
    const r = await get(page);
    if (r.status !== 200) {
      note(false, `${page} → ${r.status} (열리지 않음)`);
      continue;
    }
    const hits = needles.filter((n) => r.body.includes(n.text));
    note(hits.length === 0, `${page} — 흔적 ${hits.length}건${hits.length ? ": " + hits.map((h) => h.label).join(", ") : ""}`);
  }

  // ③ 발행된 기사 상세에도 미발행 매거진 참조가 없어야 한다(이번 결함의 진원지).
  console.log("\n[3] 발행 기사 상세의 미발행 매거진 참조");
  const risky = (
    await db.query(`
      SELECT DISTINCT a.slug FROM "Article" a
      JOIN "MagazinePage" p ON p."articleId" = a.id
      JOIN "Magazine" m ON m.id = p."magazineId"
      WHERE a.status = 'published' AND m.status <> 'published'`)
  ).rows;
  if (risky.length === 0) {
    console.log("  (미발행 매거진에 실린 발행 기사가 없어 확인 대상 없음)");
  }
  for (const a of risky) {
    const r = await get(`/articles/${a.slug}`);
    const hits = magazines.filter((m) => r.body.includes(m.id));
    note(hits.length === 0, `/articles/${a.slug} — 미발행 매거진 참조 ${hits.length}건`);
  }

  console.log(
    `\n${failures === 0 ? "통과 — 발행 전 콘텐츠 노출 없음" : `실패 ${failures}건 — 위 FAIL 항목을 확인하세요`}`,
  );
  await db.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("점검 실패:", e);
  await db.end().catch(() => {});
  process.exit(2);
});

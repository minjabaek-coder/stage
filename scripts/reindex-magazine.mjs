#!/usr/bin/env node
/**
 * 매거진 한 호를 **로컬에서** 색인한다.
 *
 * 왜 필요한가: Gemini 무료 티어의 임베딩 한도는 **분당 100건(텍스트 단위)** 이다.
 * 38호는 91쪽 → 청크 118개라 어떤 배치 전략을 써도 **1분 안에 끝날 수 없고**,
 * 어드민 "저장"은 서버리스 함수 시간 제한에 걸려 반드시 실패한다.
 * (1호가 87청크라 한도 바로 아래로 통과했던 것이지, 설계가 견딘 게 아니다.)
 *
 * 로컬에서는 시간 제한이 없으므로 한도를 지켜 천천히 돌리면 된다.
 *
 * 사용법:
 *   node scripts/reindex-magazine.mjs 38
 *   node scripts/reindex-magazine.mjs 38 --dry     # 청크만 계산하고 쓰지 않음
 *   node scripts/reindex-magazine.mjs --verify 1   # 기존 색인과 청킹이 일치하는지 검증
 *
 * ⚠️ `src/lib/chunker.ts`의 규칙을 JS로 옮겨 담았다. 원본이 바뀌면 여기도 바꿔야 한다.
 *    `--verify`가 그 어긋남을 잡는 장치다(이미 색인된 호의 청크와 대조).
 */
import pg from "pg";
import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import sanitizeHtml from "sanitize-html";

loadEnv({ path: ".env.local", quiet: true });

// ── src/lib/chunker.ts 와 동일해야 하는 상수 ──
const MAX_CHUNK_LENGTH = 600;
const OVERLAP_CHARS = 120;
const MIN_CHUNK_LENGTH = 20;

// 원본 src/lib/chunker.ts와 **같은 라이브러리**를 쓴다. 직접 흉내 내면 어긋난다 —
// 실제로 원문의 `<박경준의 스테이지>`를 sanitize-html이 `&lt;...&gt;`로 이스케이프하는데
// 그 처리를 빠뜨려 1호 검증에서 불일치가 났다.
function toParagraphs(html) {
  const withBreaks = String(html)
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section|article)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

function splitSentences(p) {
  if (p.length <= MAX_CHUNK_LENGTH) return [p];
  const sentences = p.split(/(?<=[.!?。…])\s+|(?<=다\.|요\.|까\?|죠\.)\s+/);
  const out = [];
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length > MAX_CHUNK_LENGTH && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function chunkContent(text, title) {
  if (!text || text.trim().length < MIN_CHUNK_LENGTH) return [];
  const units = [];
  for (const p of toParagraphs(text)) units.push(...splitSentences(p));

  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const u of units) {
    if (curLen + u.length > MAX_CHUNK_LENGTH && cur.length) {
      chunks.push(cur.join(" "));
      const last = cur[cur.length - 1];
      cur = last.length <= OVERLAP_CHARS ? [last] : [];
      curLen = cur.reduce((n, x) => n + x.length, 0);
    }
    cur.push(u);
    curLen += u.length;
  }
  if (cur.length) chunks.push(cur.join(" "));

  return chunks
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= MIN_CHUNK_LENGTH)
    .map((content) => ({ content: `[${title}] ${content}`, title }));
}

// ── 임베딩(무료 한도: 분당 100건) ──
const BATCH = 50;
const PER_MINUTE = 90; // 100에서 여유를 둔다
const DIMS = 1024;
const EMB_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let windowStart = 0;
let sentInWindow = 0;

async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const now = Date.now();
    if (now - windowStart >= 60_000) {
      windowStart = now;
      sentInWindow = 0;
    }
    if (sentInWindow + slice.length > PER_MINUTE) {
      const wait = 60_000 - (now - windowStart) + 1000;
      console.log(`  분당 한도 대기 ${Math.ceil(wait / 1000)}초…`);
      await new Promise((r) => setTimeout(r, wait));
      windowStart = Date.now();
      sentInWindow = 0;
    }
    // 다른 작업이 같은 분 안에 한도를 이미 썼을 수 있다 → 구글이 알려주는
    // retryDelay만큼 기다렸다 다시 시도한다.
    let vecs = null;
    for (let attempt = 0; attempt < 4 && !vecs; attempt++) {
      try {
        const res = await ai.models.embedContent({
          model: EMB_MODEL,
          contents: slice,
          config: { outputDimensionality: DIMS, taskType: "RETRIEVAL_DOCUMENT" },
        });
        vecs = (res.embeddings ?? []).map((e) => e.values ?? []);
      } catch (e) {
        const msg = String(e.message ?? e);
        const m = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
        if (attempt === 3 || !/\b429\b|RESOURCE_EXHAUSTED/.test(msg)) throw e;
        const wait = m ? Math.ceil(Number(m[1]) * 1000) + 1000 : 60_000;
        console.log(`  한도 초과 — ${Math.ceil(wait / 1000)}초 대기 후 재시도`);
        await new Promise((r) => setTimeout(r, wait));
        windowStart = Date.now();
        sentInWindow = 0;
      }
    }
    if (!vecs || vecs.length !== slice.length) throw new Error("임베딩 응답 개수 불일치");
    out.push(...vecs);
    sentInWindow += slice.length;
    console.log(`  임베딩 ${out.length}/${texts.length}`);
  }
  return out;
}

// ── 구간 → 청크 (src/lib/rag.ts generateMagazineEmbeddings의 원문 구간 갈래) ──
function buildChunks(mag, sections, coveredPages) {
  const baseHref = `/magazines/${mag.id}`;
  const baseTitle = `STAGE ${mag.issueNumber}호 · ${mag.title}`;
  const collected = [];
  for (const sec of sections) {
    if (sec.indexable === false) continue;
    if (!sec.text || !sec.text.trim()) continue;
    const from = sec.pageFrom ?? null;
    const to = sec.pageTo ?? from;
    const pages = from === null ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
    if (pages.length > 0 && pages.every((p) => coveredPages.has(p))) continue;

    const label = [
      baseTitle,
      sec.title,
      from === null ? null : from === to ? `${from}p` : `${from}-${to}p`,
    ]
      .filter(Boolean)
      .join(" · ");
    const href = from !== null ? `${baseHref}?page=${from}` : baseHref;
    for (const c of chunkContent(sec.text, label)) {
      collected.push({ ...c, href, pageNumber: from, sectionTitle: sec.title ?? null });
    }
  }
  return collected.map((c, i) => ({ ...c, chunkIndex: i }));
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  const args = process.argv.slice(2);
  const verify = args.includes("--verify");
  const dry = args.includes("--dry");
  const issue = Number(args.find((a) => /^\d+$/.test(a)));
  if (!Number.isInteger(issue)) {
    console.error("사용법: node scripts/reindex-magazine.mjs <호수> [--dry] [--verify]");
    process.exit(1);
  }

  await db.connect();
  const mag = (
    await db.query(
      `SELECT id, "issueNumber", title, status, COALESCE("sourceSections",'[]'::jsonb) s
         FROM "Magazine" WHERE "issueNumber"=$1 AND status='published'`,
      [issue],
    )
  ).rows[0];
  if (!mag) {
    console.error(`${issue}호(발행본)를 찾을 수 없습니다.`);
    process.exit(1);
  }

  // 발행+색인 대상 기사가 덮는 페이지는 기사 청크가 담당 → 매거진에서 제외(중복 방지).
  const covered = new Set(
    (
      await db.query(
        `SELECT p."pageNumber" FROM "MagazinePage" p JOIN "Article" a ON a.id=p."articleId"
          WHERE p."magazineId"=$1 AND a.status='published' AND a."aiIndexable"=true`,
        [mag.id],
      )
    ).rows.map((r) => r.pageNumber),
  );

  const chunks = buildChunks(mag, mag.s, covered);
  console.log(`${mag.issueNumber}호 "${mag.title}" — 구간 ${mag.s.length}개 → 청크 ${chunks.length}개`);
  console.log(`기사가 덮는 페이지 ${covered.size}개는 제외됨`);

  if (verify) {
    const existing = (
      await db.query(
        `SELECT content FROM "ContentChunk" WHERE "sourceType"='magazine' AND "sourceId"=$1
          ORDER BY "chunkIndex"`,
        [mag.id],
      )
    ).rows.map((r) => r.content);
    const mine = chunks.map((c) => c.content);
    const same = existing.length === mine.length && existing.every((v, i) => v === mine[i]);
    console.log(`\n검증: 기존 ${existing.length}개 vs 재계산 ${mine.length}개 → ${same ? "일치" : "불일치"}`);
    if (!same) {
      const at = existing.findIndex((v, i) => v !== mine[i]);
      console.log(`  첫 차이 index ${at}`);
      console.log(`  기존:   ${String(existing[at]).slice(0, 120)}`);
      console.log(`  재계산: ${String(mine[at]).slice(0, 120)}`);
    }
    await db.end();
    process.exit(same ? 0 : 1);
  }

  if (dry) {
    console.log("\n--dry — 쓰지 않고 종료");
    for (const c of chunks.slice(0, 3)) console.log(`  ${c.content.slice(0, 100)}…`);
    await db.end();
    return;
  }

  // 임베딩을 먼저 받고 나서 지운다 — 실패해도 기존 색인을 잃지 않는다.
  const vectors = await embedAll(chunks.map((c) => c.content));

  await db.query(`DELETE FROM "ContentChunk" WHERE "sourceType"='magazine' AND "sourceId"=$1`, [mag.id]);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    await db.query(
      `INSERT INTO "ContentChunk"
         ("id","sourceType","sourceId","chunkIndex","title","content","href","pageNumber","sectionTitle","embedding")
       VALUES (gen_random_uuid()::text,'magazine',$1,$2,$3,$4,$5,$6,$7,$8::vector)`,
      [mag.id, c.chunkIndex, c.title, c.content, c.href, c.pageNumber, c.sectionTitle, `[${vectors[i].join(",")}]`],
    );
  }
  console.log(`\n색인 완료 — ${chunks.length}개 청크`);
  await db.end();
}

main().catch(async (e) => {
  console.error("실패:", e.message ?? e);
  await db.end().catch(() => {});
  process.exit(2);
});

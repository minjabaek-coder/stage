import sanitizeHtml from "sanitize-html";

export interface ChunkData {
  chunkIndex: number;
  content: string;
  title: string;
}

// 한국어 본문 기준. 토큰≈글자수의 0.6~0.7배라 600자 ≈ 400토큰 수준.
const MAX_CHUNK_LENGTH = 600;
const OVERLAP_CHARS = 120; // 경계 손실 방지용 인접 청크 간 겹침(직전 단위 carry)
const MIN_CHUNK_LENGTH = 20;

// HTML을 블록 경계(제목·문단·리스트·인용·표·줄바꿈) 기준으로 문단 배열로 변환.
// sanitize 전에 닫는 블록 태그를 개행으로 치환해야 경계가 보존된다(이전 구현은
// 공백 정규화로 개행이 사라져 문단 분리가 사실상 무효였음).
function toParagraphs(html: string): string[] {
  const withBreaks = html
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

// 긴 문단을 문장 경계(한국어 종결어미 포함)로 분할.
function splitSentences(p: string): string[] {
  if (p.length <= MAX_CHUNK_LENGTH) return [p];
  const sentences = p.split(/(?<=[.!?。…])\s+|(?<=다\.|요\.|까\?|죠\.)\s+/);
  const out: string[] = [];
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

export function chunkBlogContent(html: string, title: string): ChunkData[] {
  if (!html || html.trim().length < MIN_CHUNK_LENGTH) return [];

  // 1) 블록 경계로 문단화 → 2) 긴 문단은 문장 분할 → 단위(unit) 배열
  const units: string[] = [];
  for (const p of toParagraphs(html)) units.push(...splitSentences(p));

  // 3) 단위를 MAX 길이까지 묶어 청크화 + 인접 청크 오버랩(직전 단위 carry)
  const chunks: string[] = [];
  let cur: string[] = [];
  let curLen = 0;
  for (const u of units) {
    if (curLen + u.length > MAX_CHUNK_LENGTH && cur.length) {
      chunks.push(cur.join(" "));
      const last = cur[cur.length - 1];
      cur = last.length <= OVERLAP_CHARS ? [last] : []; // 짧은 직전 단위만 겹침
      curLen = cur.reduce((n, x) => n + x.length, 0);
    }
    cur.push(u);
    curLen += u.length;
  }
  if (cur.length) chunks.push(cur.join(" "));

  // 4) 제목 프리픽스(검색 시 맥락 보강) + 정규화
  return chunks
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= MIN_CHUNK_LENGTH)
    .map((content, i) => ({
      chunkIndex: i,
      content: `[${title}] ${content}`,
      title,
    }));
}

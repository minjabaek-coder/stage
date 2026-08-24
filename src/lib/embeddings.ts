import { GoogleGenAI } from "@google/genai";

// 임베딩 제공자 = Gemini(챗 엔진과 동일, GEMINI_API_KEY 재사용). Voyage 의존 제거.
// gemini-embedding-001 + outputDimensionality 1024 → 기존 ContentChunk.vector(1024) 호환.
// 문서/쿼리는 taskType으로 비대칭 임베딩(검색 정확도↑). 코사인 거리(<=>)라 정규화 불필요.
const MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
const DIMS = 1024;

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Gemini 배치 임베딩은 **한 번에 최대 100개**다
// (`BatchEmbedContentsRequest.requests: at most 100 requests can be in one batch`).
// 전부 한 번에 보내던 탓에 청크 100개를 넘는 매거진은 색인이 **항상 실패**했다 —
// 38호(91쪽·약 110청크)에서 실측. 100개짜리 배치는 429(rate limit)도 맞았으므로
// 여유를 둬 50개씩 나눠 보내고, 배치 사이에 간격을 준다.
const BATCH_SIZE = 50;
const BATCH_GAP_MS = 400;

/**
 * 429 응답에 담긴 `retryDelay`(초)를 읽는다.
 *
 * 무료 티어의 실제 제약은 **분당 100건(텍스트 단위)** 이다
 * (`EmbedContentRequestsPerMinutePerUserPerProjectPerModel-FreeTier`, limit 100).
 * 구글이 "몇 초 뒤에 다시 오라"고 알려주므로, 임의 백오프보다 그 값을 쓰는 편이 정확하다.
 */
function retryAfterMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (m) return Math.ceil(Number(m[1]) * 1000) + 1000;
  return /\b429\b|RESOURCE_EXHAUSTED/.test(msg) ? 60_000 : null;
}

async function embedBatch(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await ai().models.embedContent({
        model: MODEL,
        contents: texts,
        config: { outputDimensionality: DIMS, taskType },
      });
      const out = (res.embeddings ?? []).map((e) => e.values ?? []);
      if (out.length !== texts.length || out.some((v) => v.length === 0)) {
        throw new Error("Gemini 임베딩 응답이 비정상입니다.");
      }
      return out;
    } catch (err) {
      if (attempt === 2) throw err;
      const wait = retryAfterMs(err);
      // 분당 한도에 걸린 것이면 구글이 알려준 시간만큼 기다린다.
      await new Promise((r) => setTimeout(r, wait ?? 1000 * (attempt + 1)));
    }
  }
  throw new Error("Gemini 임베딩: 재시도 초과");
}

async function embed(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_GAP_MS));
    out.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE), taskType)));
  }
  return out;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "RETRIEVAL_DOCUMENT");
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embed([text], "RETRIEVAL_QUERY");
  return embedding;
}

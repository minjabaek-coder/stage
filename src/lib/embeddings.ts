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

async function embed(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  if (texts.length === 0) return [];

  for (let attempt = 0; attempt < 2; attempt++) {
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
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini 임베딩: 재시도 초과");
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "RETRIEVAL_DOCUMENT");
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embed([text], "RETRIEVAL_QUERY");
  return embedding;
}

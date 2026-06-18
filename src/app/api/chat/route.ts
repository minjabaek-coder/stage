import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { searchChunks, buildRagContext, getSourceReferences } from "@/lib/rag";
import { prisma } from "@/lib/prisma";

// AI 마에스트로 엔진 — Gemini (무료). 모델은 GEMINI_MODEL 환경변수로 관리.
// 기본값: gemini-3.1-flash-lite (무료 티어, 최신 세대, 가장 비용효율적).
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const MAX_OUTPUT_TOKENS = 500;

const SYSTEM_PROMPT = `당신은 STAGE 매거진의 도슨트(AI 마에스트로)입니다. STAGE는 한국어 디지털 매거진 및 블로그 플랫폼입니다.
방문자들이 매거진이나 블로그 콘텐츠에 대해 궁금한 것을 물어보면 친절하고 간결하게 답변해 주세요.
검색된 콘텐츠가 제공된 경우, 해당 내용을 바탕으로 정확하게 답변하세요. 출처를 언급할 수 있습니다.
검색된 콘텐츠에 관련 정보가 없는 경우, 솔직히 모른다고 말하고 일반적인 안내를 제공하세요.
항상 한국어로 답변하세요. 답변은 2-3문장으로 간결하게 해주세요.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const startTime = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "API key가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  // RAG: retrieve relevant blog chunks for the latest user message
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  let ragContext = "";
  let sources: { title: string; slug: string }[] = [];
  try {
    const chunks = await searchChunks(lastUserMsg, 5);
    ragContext = buildRagContext(chunks);
    sources = getSourceReferences(chunks);
  } catch (err) {
    console.error("[RAG] Search failed:", err);
  }

  const systemInstruction = `${SYSTEM_PROMPT}${ragContext}`;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // Gemini roles: "user" | "model"
  const contents = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "ai" || m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const encoder = new TextEncoder();
  let fullResponse = "";
  let tokensIn = 0;
  let tokensOut = 0;

  const readableStream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeClose = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      async function logCall(status: "success" | "error", error?: string) {
        try {
          await prisma.apiCallLog.create({
            data: {
              model: MODEL,
              userMessage: lastUserMsg,
              response: fullResponse,
              sourceCount: sources.length,
              tokensIn,
              tokensOut,
              durationMs: Date.now() - startTime,
              status,
              ...(error ? { error } : {}),
            },
          });
        } catch (err) {
          console.error("[LOG] Failed to save API call log:", err);
        }
      }

      // Sources first (special event), matching the existing client contract
      if (sources.length > 0) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
        );
      }

      try {
        const stream = await ai.models.generateContentStream({
          model: MODEL,
          contents,
          config: { systemInstruction, maxOutputTokens: MAX_OUTPUT_TOKENS },
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(text)}\n\n`)
            );
          }
          if (chunk.usageMetadata) {
            tokensIn = chunk.usageMetadata.promptTokenCount ?? tokensIn;
            tokensOut = chunk.usageMetadata.candidatesTokenCount ?? tokensOut;
          }
        }

        if (!closed) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        safeClose();
        await logCall("success");
      } catch (err) {
        if (!closed) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        }
        safeClose();
        await logCall("error", String(err));
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

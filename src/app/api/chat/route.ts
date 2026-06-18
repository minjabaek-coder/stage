import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { searchChunks, buildRagContext, getSourceReferences } from "@/lib/rag";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 등급별 일일(24h) AI 질문 한도. Pro는 무제한.
const DAILY_LIMITS: Record<string, number> = {
  guest: 5,
  member: 30,
  pro: Infinity,
};

// 한도 초과 시 안내 메시지를 SSE로 스트리밍하고 종료
function limitResponse(message: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

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
  const { messages, sessionId } = await req.json();
  const startTime = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "API key가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  // 등급별 사용량 제한 (Pro 무제한). 게스트는 sessionId, 회원은 userId 기준 24h 카운트.
  const user = await getCurrentUser();
  const tier = user?.tier ?? "guest";
  const limit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.guest;
  if (limit !== Infinity) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const used = await prisma.aiInteraction.count({
        where: user
          ? { userId: user.id, createdAt: { gte: since } }
          : { userId: null, sessionId: sessionId ?? "", createdAt: { gte: since } },
      });
      if (used >= limit) {
        return limitResponse(
          user
            ? "오늘 이용 가능한 질문 횟수를 모두 사용하셨습니다. 24시간 후 다시 이용하실 수 있어요."
            : "무료 질문 횟수를 모두 사용하셨습니다. 회원가입하시면 더 많은 질문을 이용하실 수 있어요."
        );
      }
    } catch (err) {
      console.error("[chat] rate limit check failed:", err);
    }
  }

  // RAG: retrieve relevant blog/magazine chunks for the latest user message
  const lastUserMsg = messages[messages.length - 1]?.content || "";
  let ragContext = "";
  let sources: { title: string; href: string }[] = [];
  try {
    const chunks = await searchChunks(lastUserMsg, 5);
    ragContext = buildRagContext(chunks);
    sources = getSourceReferences(chunks);
  } catch (err) {
    console.error("[RAG] Search failed:", err);
  }

  // 매거진 메타데이터 grounding — "최신호 몇 호?" 같은 사실 질문에 환각 방지
  let magazineFacts = "";
  try {
    const [latest, count] = await Promise.all([
      prisma.magazine.findFirst({
        where: { status: "published" },
        orderBy: { issueNumber: "desc" },
        select: { issueNumber: true, title: true },
      }),
      prisma.magazine.count({ where: { status: "published" } }),
    ]);
    if (latest) {
      magazineFacts = `\n\n[STAGE 사실 정보] 현재 발행된 매거진은 총 ${count}개 호이며, 가장 최신 발행 호는 ${latest.issueNumber}호("${latest.title}")입니다. 호수·발행 현황 질문에는 반드시 이 정보를 사용하고, 추측하지 마세요.`;
    }
  } catch (err) {
    console.error("[chat] magazine facts failed:", err);
  }

  const systemInstruction = `${SYSTEM_PROMPT}${magazineFacts}${ragContext}`;

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

        // 사용량 기록(등급 제한 카운터 + 상호작용 로그)
        try {
          await prisma.aiInteraction.create({
            data: {
              userId: user?.id ?? null,
              sessionId: sessionId ?? null,
              question: lastUserMsg,
              answer: fullResponse,
              sourceCount: sources.length,
              provider: "gemini",
            },
          });
        } catch (e) {
          console.error("[chat] AiInteraction log failed:", e);
        }
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

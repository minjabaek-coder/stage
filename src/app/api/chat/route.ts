import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  MAESTRO_TOOLS,
  executeMaestroTool,
  type ToolSource,
} from "@/lib/maestro-tools";

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

// AI 마에스트로 엔진 — Gemini. 모델은 GEMINI_MODEL 환경변수로 관리.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
const MAX_OUTPUT_TOKENS = 500;
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT = `당신은 STAGE(한국어 문화예술 디지털 매거진)의 AI 도슨트 "마에스트로"입니다.
사용자 질문에 답하기 위해 제공된 도구를 적극적으로 사용하세요:
- 기사·매거진에 '실린 내용'(작품 해설·줄거리·작곡가·인터뷰·리뷰, 특정 시기 공연 소식 목록 등) → search_content
- STAGE가 지금 티켓 예매·할인을 안내하는 '현재/예정 이벤트' 목록 → get_culture_events
- 발행 호수·발행 현황 등 사실(예: "최신호 몇 호") → get_magazine_facts
중요: "공연/전시 정보" 질문은 대개 매거진·기사에 실린 콘텐츠입니다(예: "2025년 10월 공연 소식"). 이런 질문엔 먼저 search_content를 사용하고, get_culture_events 결과에 해당 정보가 없으면 반드시 search_content로 한 번 더 확인한 뒤 답하세요.
도구 결과에 근거해서만 정확히 답하고, 그래도 정보가 없을 때만 솔직히 모른다고 안내하세요. 추측하지 마세요.
항상 한국어로, 2-3문장으로 간결하게 답변하세요.`;

function* chunkText(s: string, size = 40): Generator<string> {
  for (let i = 0; i < s.length; i += size) yield s.slice(i, i + size);
}

export async function POST(req: NextRequest) {
  const { messages, sessionId, articleContext } = await req.json();
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

  const lastUserMsg = messages[messages.length - 1]?.content || "";

  // 기사 페이지에서 연 도슨트면 현재 기사 맥락을 주입 → "이 기사/해당 기사" 이해.
  const systemInstruction =
    typeof articleContext === "string" && articleContext.trim()
      ? `${SYSTEM_PROMPT}\n\n[현재 맥락] 사용자는 지금 「${articleContext.trim()}」 기사를 읽고 있습니다. 사용자가 "이 기사"·"해당 기사"·"요약해줘"처럼 대상을 생략하면 이 기사를 가리킵니다. 그럴 땐 되묻지 말고 search_content로 「${articleContext.trim()}」를 검색해 근거로 답하세요.`
      : SYSTEM_PROMPT;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents: Content[] = messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role === "ai" || m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })
  );

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

      const sourceMap = new Map<string, ToolSource>();

      async function logCall(status: "success" | "error", error?: string) {
        try {
          await prisma.apiCallLog.create({
            data: {
              model: MODEL,
              userMessage: lastUserMsg,
              response: fullResponse,
              sourceCount: sourceMap.size,
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

      try {
        // 에이전틱 루프: 모델이 도구를 호출하면 실행→결과 반환을 반복, 최종 텍스트 생성
        let finalText = "";
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const resp = await ai.models.generateContent({
            model: MODEL,
            contents,
            config: {
              systemInstruction,
              tools: MAESTRO_TOOLS,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
          });

          if (resp.usageMetadata) {
            tokensIn += resp.usageMetadata.promptTokenCount ?? 0;
            tokensOut += resp.usageMetadata.candidatesTokenCount ?? 0;
          }

          const fcs = resp.functionCalls;
          if (!fcs || fcs.length === 0) {
            finalText = resp.text ?? "";
            break;
          }

          // 모델의 도구 호출 턴을 그대로 대화에 추가(Gemini 3의 thoughtSignature 보존 필수)
          const modelContent = resp.candidates?.[0]?.content;
          if (modelContent) {
            contents.push(modelContent);
          } else {
            contents.push({
              role: "model",
              parts: fcs.map((fc) => ({
                functionCall: { name: fc.name, args: fc.args },
              })),
            });
          }

          // 각 도구 실행 후 결과를 functionResponse로 반환
          const responseParts: Part[] = [];
          for (const fc of fcs) {
            const { result, sources } = await executeMaestroTool(
              fc.name ?? "",
              (fc.args ?? {}) as Record<string, unknown>
            );
            for (const s of sources) sourceMap.set(s.href, s);
            responseParts.push({
              functionResponse: { name: fc.name ?? "", response: { result } },
            });
          }
          contents.push({ role: "user", parts: responseParts });
        }

        if (!finalText) {
          finalText = "죄송합니다, 지금은 답변을 생성하지 못했습니다.";
        }
        fullResponse = finalText;

        // 출처 먼저(클라이언트 계약), 이어서 답변을 청크로 스트리밍
        const sources = [...sourceMap.values()];
        if (sources.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
          );
        }
        for (const piece of chunkText(finalText)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(piece)}\n\n`));
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
              sourceCount: sourceMap.size,
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

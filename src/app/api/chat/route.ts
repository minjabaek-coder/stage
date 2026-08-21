import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  MAESTRO_TOOLS,
  executeMaestroTool,
  type ToolSource,
} from "@/lib/maestro-tools";
import {
  SESSION_DAILY_LIMIT,
  clientIpFrom,
  hitClientCeiling,
} from "@/lib/rate-limit";
import { extractCitations } from "@/lib/citations";
import {
  formatAnswerFragment,
  dropEmptySourcePromise,
  splitEmittable,
} from "@/lib/answer-format";

// 등급별 일일(24h) AI 질문 한도. Pro는 무제한.
// 게스트 한도는 클라이언트가 보내는 sessionId 기준이라 지우면 초기화된다 →
// 서버 측 축(IP 해시 일일 천장)을 별도로 겹쳐 우회를 막는다(src/lib/rate-limit.ts).
const DAILY_LIMITS: Record<string, number> = {
  guest: SESSION_DAILY_LIMIT,
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

// 도구를 부르는 동안 "무엇을 하는 중인지" 알린다.
//
// 실측상 지연의 대부분은 도구 실행(66~527ms)이 아니라 **모델 호출**(1.4~14초)이고,
// 그마저 답을 정하는 라운드와 답을 쓰는 라운드로 두 번이다. 첫 라운드는 화면에
// 내놓을 텍스트가 없어 사용자는 빈 점 세 개만 본다. 시간을 줄일 수 없다면 최소한
// 무엇을 기다리는지는 보여준다.
const TOOL_STATUS: Record<string, string> = {
  search_content: "매거진·기사를 찾는 중",
  get_magazine_contents: "목차를 확인하는 중",
  get_magazine_facts: "발행 현황을 확인하는 중",
  get_culture_events: "공연 정보를 확인하는 중",
};

const SYSTEM_PROMPT = `당신은 STAGE(한국어 문화예술 디지털 매거진)의 AI 도슨트 "마에스트로"입니다.
사용자 질문에 답하기 위해 제공된 도구를 적극적으로 사용하세요:
- 기사·매거진에 '실린 내용'(작품 해설·줄거리·작곡가·인터뷰·리뷰, 특정 시기 공연 소식 목록 등) → search_content
- 특정 호에 '무엇이 실렸는지'(목차·구성·꼭지 목록. 예: "1호에 뭐 실렸어", "이번 호 특집") → get_magazine_contents
- STAGE가 지금 티켓 예매·할인을 안내하는 '현재/예정 이벤트' 목록 → get_culture_events
- 발행 호수·발행 현황 등 사실(예: "최신호 몇 호") → get_magazine_facts
중요: "공연/전시 정보" 질문은 대개 매거진·기사에 실린 콘텐츠입니다(예: "2025년 10월 공연 소식"). 이런 질문엔 먼저 search_content를 사용하고, get_culture_events 결과에 해당 정보가 없으면 반드시 search_content로 한 번 더 확인한 뒤 답하세요.
[답변 근거 원칙] — 순서를 반드시 지키세요.
1. **무조건 도구로 먼저 찾아보세요.** 답을 이미 알고 있더라도 마찬가지입니다. 작품·인물·공연 이름이 나오면 STAGE가 그 주제를 이미 다뤘을 가능성이 높습니다(예: "피가로의 결혼은 어떤 작품이야?" → search_content).
2. **도구가 자료를 찾았으면 그 자료를 근거로 답하세요.** 이때 "매거진에 실린 내용은 아니지만"이라고 말하면 **거짓말**이 됩니다 — 절대 쓰지 마세요. 매거진 밖 배경지식을 덧붙일 수는 있지만, 매거진에 실린 부분과 덧붙인 부분이 구분되게 쓰세요.
3. **도구가 아무것도 찾지 못했을 때만** 세상의 일반 지식(작곡가의 생애, 작품 줄거리, 신화·역사, 예술 용어 등)으로 답하세요. 이때는 **반드시 "매거진에 실린 내용은 아니지만,"으로 답변을 시작**하고, 마지막 줄에 \`[출처: 없음]\`이라고 적으세요.
4. **STAGE에 관한 사실은 도구 결과만이 진실입니다.** 발행 호수, 어느 호에 무엇이 실렸는지, 기사·공연의 존재 여부, 페이지 번호는 도구 결과에 없으면 **절대 지어내지 마세요**. 존재하지 않는 호수를 묻더라도 목차나 수록 내용을 만들어내면 안 됩니다. 이것은 3번의 예외가 아닙니다 — 일반 지식으로 메울 수 없는 영역입니다.
확실하지 않으면 단정하지 말고 불확실하다고 밝히세요.
항상 한국어로 간결하게 답변하세요(기본 2-3문장).
다만 목차·구성처럼 **나열이 필요한 질문**에는 항목을 빠짐없이 짧게 나열하세요 — 일부만 추리면 "무엇이 실렸나"에 대한 답이 되지 못합니다.

[표현 규칙]
- 답변은 **평문**으로 쓰세요. \`**굵게**\`·\`* 불릿\`·\`# 제목\` 같은 마크다운 기호는 화면에 기호 그대로 보이므로 쓰지 마세요.
- 나열할 때는 기호 없이 **항목마다 줄바꿈**만 하세요.

[링크 요청]
STAGE 웹사이트는 **외부 사이트가 아니라 당신이 안내하는 바로 그 사이트**입니다. "링크 줄래"·"어디서 봐"라는 요청을 "외부 URL은 만들 수 없다"며 거절하지 마세요.
- 링크는 **출처를 만드는 도구를 호출해야만** 생깁니다: \`get_magazine_contents\`(매거진 호) · \`search_content\`(기사·본문) · \`get_culture_events\`(이벤트). **\`get_magazine_facts\`에는 링크가 없습니다** — 이것만 부르고 "아래 출처 링크"라고 안내하면 사용자에게는 빈 약속이 됩니다.
- 그 도구 결과를 근거로 답하고 **인용 번호를 반드시 남기세요**. 그러면 답변 아래에 바로 열 수 있는 링크가 표시됩니다.
- 인용할 자료가 하나도 없다면 "아래 출처 링크"라는 말을 쓰지 말고, 어디서 찾을 수 있는지 말로 안내하세요.
- URL 주소를 직접 지어내지는 마세요.

도구 결과의 각 자료에는 ref 번호가 있습니다. 답변 **맨 마지막 줄**에 실제로 근거로 삼은 자료 번호만 \`[출처: 1, 3]\` 형식으로 적으세요.
- 읽어봤지만 답변에 쓰지 않은 자료는 넣지 마세요.
- 도구 결과를 근거로 쓰지 않았다면(위 3번) \`[출처: 없음]\`이라고 적으세요. 줄을 통째로 빠뜨리면 무관한 자료가 출처로 붙습니다.
이 줄은 사용자에게 보이지 않고 출처 링크를 고르는 데만 쓰입니다.`;

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

  // 서버 측 천장(게스트만) — sessionId를 갈아끼워도 넘을 수 없다.
  // 회원은 userId로 이미 서버 측 식별이 되므로 적용하지 않는다.
  if (!user) {
    const { exceeded } = await hitClientCeiling(clientIpFrom(req.headers));
    if (exceeded) {
      return limitResponse(
        "무료 질문 횟수를 모두 사용하셨습니다. 회원가입하시면 더 많은 질문을 이용하실 수 있어요.",
      );
    }
  }

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

      // ref 번호로 관리한다(같은 href가 여러 ref를 가질 수 있음 — 한 페이지의 여러 청크).
      const sourceMap = new Map<number, ToolSource>();
      // 로그에는 '실제로 사용자에게 보인' 출처 수를 남긴다. 검색된 후보 수(sourceMap.size)를
      // 쓰면 인용 필터 이후 화면과 어긋나 통계가 부풀려진다.
      let shownSourceCount = 0;

      async function logCall(status: "success" | "error", error?: string) {
        try {
          await prisma.apiCallLog.create({
            data: {
              model: MODEL,
              userMessage: lastUserMsg,
              response: fullResponse,
              sourceCount: shownSourceCount,
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

      // 완결된 문장이 나오는 즉시 흘려보낸다. 보류분(hold)은 인용 줄·출처 약속일 수
      // 있어 끝까지 봐야 판단할 수 있다(lib/answer-format의 splitEmittable).
      let emitted = "";
      let hold = "";
      const flushSafe = (chunk: string) => {
        hold += chunk;
        const { emit, hold: rest } = splitEmittable(hold);
        hold = rest;
        if (!emit) return;
        const out = formatAnswerFragment(emit);
        emitted += out;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`));
      };

      try {
        // 에이전틱 루프: 모델이 도구를 호출하면 실행→결과 반환을 반복, 최종 텍스트 생성
        let finalText = "";
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          // 스트리밍으로 받는다. 종전 generateContent는 답변을 **다 만든 뒤에야**
          // 첫 글자를 내보내 체감 대기가 곧 생성 시간이었다(실측 TTFT = 총시간의 100%,
          // 2.5~8.5초). 청크 단위로 흘리면 첫 글자가 1초 안쪽에 뜬다.
          const stream = await ai.models.generateContentStream({
            model: MODEL,
            contents,
            config: {
              systemInstruction,
              tools: MAESTRO_TOOLS,
              maxOutputTokens: MAX_OUTPUT_TOKENS,
            },
          });

          const parts: Part[] = [];
          const fcs: { name?: string; args?: Record<string, unknown> }[] = [];
          let roundText = "";

          for await (const ch of stream) {
            if (ch.usageMetadata) {
              tokensIn += ch.usageMetadata.promptTokenCount ?? 0;
              tokensOut += ch.usageMetadata.candidatesTokenCount ?? 0;
            }
            // thoughtSignature는 part에 실려 온다 — 도구 루프에 그대로 되돌려줘야 하므로
            // 청크마다 모아 모델 턴을 재구성한다(스트리밍에서도 보존되는 것을 실측 확인).
            for (const p of ch.candidates?.[0]?.content?.parts ?? []) parts.push(p);
            if (ch.functionCalls?.length) fcs.push(...ch.functionCalls);

            const t = ch.text ?? "";
            if (t && fcs.length === 0) {
              roundText += t;
              flushSafe(t);
            } else if (t) {
              roundText += t;
            }
          }

          if (fcs.length === 0) {
            finalText = roundText;
            break;
          }

          // 도구 호출과 텍스트가 한 라운드에 섞여 나왔고 이미 내보낸 게 있으면,
          // 그 텍스트는 최종 답변이 아니다 → 말풍선을 비우라고 알린다(실측상 드묾).
          if (emitted) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reset: true })}\n\n`));
            emitted = "";
          }
          hold = "";

          // 모델의 도구 호출 턴을 그대로 대화에 추가(Gemini 3의 thoughtSignature 보존 필수)
          if (parts.length > 0) {
            contents.push({ role: "model", parts });
          } else {
            contents.push({
              role: "model",
              parts: fcs.map((fc) => ({
                functionCall: { name: fc.name, args: fc.args },
              })),
            });
          }

          // 무엇을 찾는 중인지 알린다(텍스트가 시작되면 클라이언트가 지운다).
          const status = TOOL_STATUS[fcs[0]?.name ?? ""];
          if (status) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ status })}\n\n`),
            );
          }

          // 각 도구 실행 후 결과를 functionResponse로 반환
          const responseParts: Part[] = [];
          for (const fc of fcs) {
            const { result, sources } = await executeMaestroTool(
              fc.name ?? "",
              (fc.args ?? {}) as Record<string, unknown>,
              sourceMap.size // 도구를 여러 번 불러도 ref가 겹치지 않게 이어서 매긴다
            );
            for (const s of sources) sourceMap.set(s.ref, s);
            responseParts.push({
              functionResponse: { name: fc.name ?? "", response: { result } },
            });
          }
          contents.push({ role: "user", parts: responseParts });
        }

        if (!finalText && !emitted) {
          finalText = "죄송합니다, 지금은 답변을 생성하지 못했습니다.";
          hold = finalText;
        }

        // 인용 줄을 떼어내고, 모델이 실제로 쓴 자료만 출처로 남긴다.
        // 인용 줄은 답변 맨 끝이라 항상 보류분(hold)에 들어 있다.
        const cited = extractCitations(finalText);

        // 세 갈래를 구분한다:
        //   refs=null  형식 미준수(줄 자체가 없음) → 종전대로 전부 노출. 0개보다는 낫다.
        //   refs=[]    "[출처: 없음]" — 매거진 근거 없이 답했다는 명시적 신고 → 칩 없음.
        //              이 갈래가 없으면 일반 지식 답변에 무관한 검색 후보가 출처로 붙는다.
        //   refs=[..]  인용된 것만.
        const all = [...sourceMap.values()];
        let chosen: ToolSource[];
        if (cited.refs === null) {
          chosen = all;
        } else if (cited.refs.length === 0) {
          chosen = [];
        } else {
          const picked = all.filter((s) => cited.refs!.includes(s.ref));
          chosen = picked.length > 0 ? picked : all;
        }
        // 같은 페이지의 여러 청크가 각각 ref를 갖는다 → 칩은 href로 중복 제거.
        const seenHref = new Set<string>();
        const sources = chosen.filter((s) => {
          if (seenHref.has(s.href)) return false;
          seenHref.add(s.href);
          return true;
        });
        shownSourceCount = sources.length;

        // 남은 보류분을 마무리한다 — 인용 줄 제거 → 마크다운 정리 →
        // 출처가 없는데 "아래 출처 링크에서 보세요"라고 했으면 그 문장 제거.
        // 출처 수가 정해진 뒤라야 마지막 판단이 가능해 여기서 처리한다.
        let tail = extractCitations(hold).text;
        tail = formatAnswerFragment(tail);
        tail = dropEmptySourcePromise(tail, sources.length > 0);
        if (tail.trim()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(tail)}\n\n`));
        }

        fullResponse = (emitted + tail).trim();

        // 출처칩은 인용 줄을 봐야 정해지므로 텍스트 뒤에 보낸다.
        // 클라이언트는 도착 순서와 무관하게 마지막 메시지에 붙인다(docent-chat).
        if (sources.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
          );
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
              sourceCount: shownSourceCount,
              provider: "gemini",
            },
          });
        } catch (e) {
          console.error("[chat] AiInteraction log failed:", e);
        }
      } catch (err) {
        if (!closed) {
          // 상류 오류 원문(서비스명·내부 구조)을 그대로 내보내지 않는다 — 상세는 로그에만.
          // 클라이언트는 이 이벤트를 '실패' 신호로만 쓴다(docent-chat의 error 분기).
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`)
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

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface SourceRef {
  title: string;
  href: string;
}

interface Message {
  role: "ai" | "user";
  content: string;
  sources?: SourceRef[];
}

const WELCOME_MESSAGE: Message = {
  role: "ai",
  content:
    "안녕하세요, STAGE의 AI 도슨트 마에스트로예요. 매거진·기사에 실린 작품 배경·작곡가·공연 정보를 함께 풀어드릴게요.",
};

// 빈 상태(대화 시작 전) 중앙에 보여줄 안내 한 줄
const EMPTY_HINT = "이런 것들을 물어볼 수 있어요";

// 빈 화면 시작 프롬프트 — 누르면 바로 전송. 독립 페이지·팝업 어디서나 맥락 없이
// 자연스럽도록 일반 질문으로 구성(특정 호·기사 맥락 가정 금지).
const STARTERS = [
  "최신호에는 어떤 이야기가 있어?",
  "요즘 볼만한 공연 추천해줘",
  "이 달의 전시 소식 알려줘",
  "성악·오페라 용어를 쉽게 설명해줘",
];

// 스트리밍 대기 중 표시(점 3개 애니메이션)
function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal/60"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// 게스트(미로그인) 사용량 식별용 sessionId. localStorage에 영속.
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("stage_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("stage_session_id", id);
  }
  return id;
}

export function ChatBody({ seedQuestion }: { seedQuestion?: string }) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState(seedQuestion ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // 새 메시지 시 '내부 메시지 영역'만 맨 아래로(윈도우는 그대로 — 페이지가 통째로
  // 내려가 히어로가 가려지던 문제 방지). 첫 마운트(인사말만)에선 스크롤하지 않음.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 이미 열린 채팅에서 다른 시드 질문(기사 위젯 칩)을 누르면 입력창을 갱신
  useEffect(() => {
    if (seedQuestion) setInput(seedQuestion);
  }, [seedQuestion]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    // Add empty AI message for streaming
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          sessionId: getSessionId(),
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n").filter(Boolean);

        for (const line of lines) {
          const data = line.replace("data: ", "");
          if (data === "[DONE]") break;

          const parsed = JSON.parse(data);

          // Handle sources event
          if (parsed && typeof parsed === "object" && parsed.sources) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                sources: parsed.sources,
              };
              return updated;
            });
            continue;
          }

          // Handle text chunk
          if (typeof parsed === "string") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                content: last.content + parsed,
              };
              return updated;
            });
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role === "ai" && last.content === "") {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            content: "죄송합니다. 응답을 받을 수 없습니다.",
          };
          return updated;
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSend() {
    sendMessage(input);
  }

  // 대화 시작 전(인사말만): 빈 상태 — 인사말+시작칩을 중앙에 배치(허전함 방지)
  const isEmpty = messages.length === 1 && !isLoading;

  const starterChips = (
    <div className="flex flex-wrap justify-center gap-2">
      {STARTERS.map((q) => (
        <button
          key={q}
          onClick={() => sendMessage(q)}
          className="rounded-full border border-teal/30 bg-white px-3.5 py-1.5 text-sm text-teal-deep transition-colors hover:border-teal hover:bg-teal/5"
        >
          {q}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className={
          isEmpty
            ? "flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-5 px-4 text-center"
            : "flex-1 min-h-0 overflow-y-auto space-y-3"
        }
      >
        {isEmpty ? (
          <>
            <p className="max-w-md text-sm leading-relaxed text-ink-muted">
              {WELCOME_MESSAGE.content}
            </p>
            <p className="font-label text-[11px] uppercase tracking-[0.2em] text-ink-muted/70">
              {EMPTY_HINT}
            </p>
            {starterChips}
          </>
        ) : (
          messages.map((msg, i) => {
            const isLastAi = i === messages.length - 1 && msg.role === "ai";
            const isStreaming = isLastAi && isLoading && msg.content === "";
            return (
              <div key={i}>
                <div
                  className={
                    msg.role === "ai"
                      ? "bg-surface-warm text-ink rounded-lg p-3 text-sm leading-relaxed max-w-[80%]"
                      : "bg-ink text-white rounded-lg p-3 text-sm max-w-[80%] ml-auto"
                  }
                >
                  {isStreaming ? <TypingDots /> : msg.content}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[80%]">
                    {msg.sources.map((src, j) => (
                      <Link
                        key={j}
                        href={src.href}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-surface-warm rounded text-[10px] font-label text-teal-deep hover:bg-surface-warm/70 transition-colors"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        {src.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2 mt-3 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="메시지를 입력하세요"
          disabled={isLoading}
          className="flex-1 bg-transparent border-b border-ink/20 py-2 font-label text-base lg:text-xs focus:outline-none focus:border-teal transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="font-label text-xs font-bold uppercase tracking-widest text-teal-deep hover:text-ink transition-colors disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}

/** FAB + 팝업 채팅 (모든 뷰포트) */
export function DocentChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  // 외부(홈 CTA·기사 위젯 등)에서 챗을 열 수 있도록 커스텀 이벤트 수신.
  // detail.question이 있으면 입력창을 미리 채운다(기사 내 AI 위젯 등).
  useEffect(() => {
    const open = (e: Event) => {
      const q = (e as CustomEvent).detail?.question;
      setSeed(typeof q === "string" ? q : undefined);
      setIsOpen(true);
    };
    window.addEventListener("stage:open-docent", open);
    return () => window.removeEventListener("stage:open-docent", open);
  }, []);

  // 배경 스크롤 잠금은 '모바일 전체화면'일 때만. 데스크톱은 우하단 작은 팝업이라
  // 잠그면 뒤 기사를 못 읽고 맨 위로 튕김 → 데스크톱에선 배경 스크롤 유지.
  useEffect(() => {
    if (!isOpen) return;
    if (window.innerWidth >= 1024) return; // lg 이상(데스크톱)은 잠그지 않음
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = orig;
    };
  }, [isOpen]);

  // Adjust height to visualViewport on mobile (handles keyboard)
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv || !panelRef.current) return;

    function update() {
      if (!vv || !panelRef.current) return;
      // Only apply on mobile (lg breakpoint = 1024px)
      if (window.innerWidth >= 1024) return;
      panelRef.current.style.height = `${vv.height}px`;
      panelRef.current.style.top = `${vv.offsetTop}px`;
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen]);

  return (
    <>
      {/* 팝업 패널 — 모바일: 전체화면, 데스크탑: 우하단 팝업 */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed inset-0 z-50 bg-white flex flex-col p-6 lg:inset-auto lg:bottom-24 lg:right-6 lg:w-[calc(100vw-3rem)] lg:max-w-md lg:h-[600px] lg:max-h-[calc(100vh-8rem)] lg:rounded-2xl lg:shadow-2xl lg:flex-none"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-label text-sm font-black tracking-[0.2em] uppercase">
              도슨트
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-ink/50 hover:text-ink transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ChatBody seedQuestion={seed} />
          </div>
        </div>
      )}

      {/* FAB 버튼 — 모바일 전체화면일 때 숨김 */}
      {!isOpen && (
        <button
          onClick={() => {
            setSeed(undefined);
            setIsOpen(true);
          }}
          className="fixed bottom-6 right-6 z-50 hidden h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-colors hover:bg-teal md:flex"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </>
  );
}

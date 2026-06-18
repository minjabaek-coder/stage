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
    "안녕하세요! STAGE 도슨트입니다. 매거진이나 블로그에 대해 궁금한 것을 물어보세요.",
};

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

export function ChatBody() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={
                msg.role === "ai"
                  ? "bg-[#f6f3f2] rounded-lg p-3 text-sm max-w-[80%]"
                  : "bg-[#1c1b1b] text-white rounded-lg p-3 text-sm max-w-[80%] ml-auto"
              }
            >
              {msg.content}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[80%]">
                {msg.sources.map((src, j) => (
                  <Link
                    key={j}
                    href={src.href}
                    target="_blank"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[#f6f3f2] rounded text-[10px] font-label text-[#6f5c24] hover:bg-[#ebe6e4] transition-colors"
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
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 mt-3 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="메시지를 입력하세요"
          disabled={isLoading}
          className="flex-1 bg-transparent border-b border-[#1c1b1b]/20 py-2 font-label text-base lg:text-xs focus:outline-none focus:border-[#6f5c24] transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="font-label text-xs font-bold uppercase tracking-widest text-[#6f5c24] hover:text-[#1c1b1b] transition-colors disabled:opacity-50"
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
  const panelRef = useRef<HTMLDivElement>(null);

  // 외부(예: 홈 마에스트로 섹션 CTA)에서 챗을 열 수 있도록 커스텀 이벤트 수신
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener("stage:open-docent", open);
    return () => window.removeEventListener("stage:open-docent", open);
  }, []);

  // Lock body scroll when chat is open on mobile
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Scroll to top to prevent offset issues
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
          className="fixed inset-0 z-50 bg-white flex flex-col p-6 lg:inset-auto lg:bottom-24 lg:right-6 lg:w-[calc(100vw-3rem)] lg:max-w-md lg:h-auto lg:rounded-2xl lg:shadow-2xl lg:flex-none"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-label text-sm font-black tracking-[0.2em] uppercase">
              도슨트
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#1c1b1b]/50 hover:text-[#1c1b1b] transition-colors"
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
            <ChatBody />
          </div>
        </div>
      )}

      {/* FAB 버튼 — 모바일 전체화면일 때 숨김 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1c1b1b] text-white flex items-center justify-center shadow-lg hover:bg-[#6f5c24] transition-colors"
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

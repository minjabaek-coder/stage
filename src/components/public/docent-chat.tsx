"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { getCurrentArticleTitle } from "@/lib/article-context";

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
  // 바닥에 붙어 따라갈지 여부. 사용자가 위로 올려 읽는 중이면 해제한다(일반적인 챗 동작).
  const stickToBottom = useRef(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  // 새 메시지 시 '내부 메시지 영역'만 맨 아래로(윈도우는 그대로 — 페이지가 통째로
  // 내려가 히어로가 가려지던 문제 방지). 첫 마운트(인사말만)에선 스크롤하지 않음.
  //
  // 스트리밍 중에는 텍스트 청크마다 setMessages가 돌아 이 이펙트도 매번 실행된다.
  // 그때 behavior:"smooth"를 쓰면 끝나지 않은 애니메이션이 계속 재시작돼 끈적하게
  // 미끄러지고, 사용자가 위로 올려 읽어도 계속 아래로 끌려간다. → 스트리밍 중엔 즉시
  // 이동(auto), 그리고 바닥 근처일 때만 따라간다.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: isLoading ? "auto" : "smooth" });
  }, [messages, isLoading]);

  // 이미 열린 채팅에서 다른 시드 질문(기사 위젯 칩)을 누르면 입력창을 갱신
  useEffect(() => {
    if (seedQuestion) setInput(seedQuestion);
  }, [seedQuestion]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    stickToBottom.current = true; // 내가 보낸 메시지는 항상 따라간다
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
          articleContext: getCurrentArticleTitle(),
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

          // Handle error event — 서버가 스트림 안에서 오류를 알려온 경우.
          // 이 분기가 없으면 상류 오류(예: Gemini 503 high demand) 때 빈 말풍선만 남는다.
          if (parsed && typeof parsed === "object" && parsed.error) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              // 이미 일부라도 답이 나왔으면 지우지 않고 뒤에 붙인다.
              updated[updated.length - 1] = {
                ...last,
                content: last.content
                  ? `${last.content}\n\n(답변이 중단되었습니다. 잠시 후 다시 시도해 주세요.)`
                  : "지금은 답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
              };
              return updated;
            });
            continue;
          }

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
      {/* overscroll-contain: 목록 끝에 닿아도 휠이 뒤 페이지로 넘어가지 않게(스크롤 체이닝 차단).
          데스크톱은 배경 스크롤을 잠그지 않으므로 이게 없으면 홈이 팝업 뒤에서 움직인다. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={
          isEmpty
            ? "flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-center gap-5 px-4 text-center"
            : "flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3"
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
                  // whitespace-pre-wrap 필수 — 없으면 줄바꿈이 접혀 목차 같은
                  // 나열형 답변이 한 문단으로 뭉친다(S1-1이 공들인 답변이 직격탄).
                  className={
                    msg.role === "ai"
                      ? "bg-surface-warm text-ink rounded-lg p-3 text-sm leading-relaxed max-w-[80%] whitespace-pre-wrap break-words"
                      : "bg-ink text-white rounded-lg p-3 text-sm max-w-[80%] ml-auto whitespace-pre-wrap break-words"
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

/**
 * 항상 보여야 하는 전역 크롬(헤더·장르탭·모바일 하단탭바)의 높이를 잰다.
 * 팝업은 이 값만큼 비켜 앉아 크롬을 절대 가리지 않는다(헤더 우선 원칙).
 *
 * 위치(rect)가 아니라 **높이의 합**을 쓰는 이유: 헤더 위의 StageOS 배너가 스티키가 아니라서
 * 헤더의 화면상 위치가 스크롤에 따라 변한다(최상단 115px → 배너 지나면 59px). 팝업은 fixed라
 * 같이 움직이지 않으므로, 스크롤 위치를 따라다니며 팝업을 옮기면(=흔들림) 오히려 부자연스럽다.
 * → 배너까지 포함한 **최악의 경우**를 한 번 확보해 어느 스크롤 위치에서도 겹치지 않게 한다.
 * 배너를 닫으면 DOM에서 사라지므로 합계가 자동으로 줄어든다.
 */
function useChromeInsets(active: boolean) {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const sum = (sel: string) =>
        Array.from(document.querySelectorAll<HTMLElement>(sel)).reduce(
          (n, el) => n + el.offsetHeight,
          0,
        );
      setInsets((prev) => {
        const next = {
          top: sum('[data-site-chrome="top"]'),
          bottom: sum('[data-site-chrome="bottom"]'),
        };
        return prev.top === next.top && prev.bottom === next.bottom ? prev : next;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    // 배너는 설정을 비동기로 받아 뒤늦게 나타나거나 사용자가 닫아 사라진다 → body 크기 변화로 감지.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [active]);

  return insets;
}

/** FAB + 팝업 채팅 (모든 뷰포트) */
export function DocentChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);
  const chrome = useChromeInsets(isOpen);

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
      if (window.innerWidth >= 1024) {
        panelRef.current.style.height = "";
        panelRef.current.style.top = "";
        return;
      }
      // 전역 크롬(헤더 위 / 하단탭바 아래)을 비워두고 그 사이만 차지한다.
      panelRef.current.style.height = `${Math.max(240, vv.height - chrome.top - chrome.bottom)}px`;
      panelRef.current.style.top = `${vv.offsetTop + chrome.top}px`;
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen, chrome.top, chrome.bottom]);

  return (
    <>
      {/* 팝업 패널 — 모바일: 전체화면, 데스크탑: 우하단 팝업 */}
      {isOpen && (
        <div
          ref={panelRef}
          style={
            {
              "--chrome-top": `${chrome.top}px`,
              "--chrome-bottom": `${chrome.bottom}px`,
            } as CSSProperties
          }
          // 헤더 우선 원칙: 팝업은 전역 크롬을 덮지 않는다(z를 올리지 않고 자리를 비켜준다).
          //  · 모바일·태블릿(전체화면): 헤더 아래 ~ 하단탭바 위 사이만 차지.
          //  · 데스크톱(lg+): 우하단 팝업. 높이를 `100vh − 헤더 − 아래여백(96) − 간격(12)`으로
          //    제한해, 짧은 화면(≈728px 이하)에서 상단이 헤더에 파고들던 문제를 없앤다.
          // overscroll-contain: 패널 위에서 굴린 휠이 뒤 페이지로 새지 않게.
          className="fixed inset-x-0 top-[var(--chrome-top)] bottom-[var(--chrome-bottom)] z-50 flex flex-col overflow-hidden overscroll-contain bg-white p-6 lg:inset-auto lg:bottom-24 lg:right-6 lg:top-auto lg:h-[600px] lg:max-h-[calc(100vh-var(--chrome-top)-108px)] lg:w-[calc(100vw-3rem)] lg:max-w-md lg:flex-none lg:rounded-2xl lg:shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-label text-sm font-black tracking-[0.2em] uppercase">
              도슨트
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              // 아이콘 전용 버튼 — axe는 패널이 닫혀 있어 못 잡았지만 FAB와 같은 결함이다.
              aria-label="도슨트 닫기"
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
          // 아이콘만 있는 버튼이라 접근 가능한 이름이 없었다(axe button-name, critical).
          // 스크린리더에는 "버튼"으로만 읽혀 무엇인지 알 수 없다.
          aria-label="AI 도슨트 마에스트로 열기"
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

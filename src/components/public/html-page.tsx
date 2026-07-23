"use client";

import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";

// kind=html 매거진 페이지 렌더 — Shadow DOM으로 격리 렌더.
// iframe(sandbox) 대신 Shadow DOM을 쓰는 이유: react-pageflip의 3D 넘김 애니메이션 중
// iframe이 리페인트되며 흰 화면이 깜빡이는 브라우저 한계를 피하고, 스타일 격리는 유지하기 위함.
// 보안: HTML은 저장 시 서버에서 sanitize(<script>·on* 이벤트·위험 스킴 제거)되고, host는
// pointer-events:none이라 상호작용도 차단된다. innerHTML로 주입된 <script>는 실행되지 않는다.
// 렌더 일관: 고정 논리 지면(800×1200=2:3)에 그린 뒤 부모(2:3 박스)에 맞춰 transform:scale.
const REF_W = 800;
const REF_H = 1200;

export function HtmlPage({
  html,
  className,
  onDropImageUrl,
}: {
  html: string;
  className?: string;
  // 편집기 미리보기 전용: 라이브러리 이미지를 페이지의 <img> 영역에 드롭하면
  // (드롭 지점에서 가장 가까운 <img>의 인덱스, url)을 콜백해 코드의 src를 채우게 한다.
  onDropImageUrl?: (imgIndex: number, url: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [scale, setScale] = useState(1);
  const [dropActive, setDropActive] = useState(false);

  // 드롭 지점 요소에서 대상 <img> 찾기(자기 자신 → 자식 → 조상의 자식 순).
  // 빈 src로 display:none인 <img>도 컨테이너를 통해 찾도록 querySelector로 훑는다.
  function findImgNear(el: Element | null, root: ShadowRoot): Element | null {
    let cur: Element | null = el;
    while (cur && (cur as unknown as ShadowRoot) !== root) {
      if (cur.tagName === "IMG") return cur;
      const inside = cur.querySelector?.("img");
      if (inside) return inside;
      cur = cur.parentElement;
    }
    return null;
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    const root = shadowRef.current;
    if (!onDropImageUrl || !root) return;
    const url = e.dataTransfer.getData("application/x-mag-url");
    if (!url) return;
    e.preventDefault();
    setDropActive(false);
    const el = root.elementFromPoint(e.clientX, e.clientY);
    const img = findImgNear(el, root);
    const imgs = Array.from(root.querySelectorAll("img"));
    const idx = img ? imgs.indexOf(img as HTMLImageElement) : -1;
    onDropImageUrl(idx, url);
  }

  // Shadow DOM 생성(1회) + HTML 주입. 스타일은 shadow 경계 안에 격리된다.
  // innerHTML은 fragment 파싱이라 <html>·<body> 태그가 벗겨져 `html,body{}` CSS가 무효화된다.
  // → DOMParser로 완전한 문서를 파싱해 <html> 요소를 통째로 넣어 body/html 규칙을 살린다.
  // (파서 생성 <script>는 실행되지 않고, 저장 시 sanitize로 이미 제거된다.)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) shadowRef.current = host.attachShadow({ mode: "open" });
    const src = html && html.trim() ? html : "<!doctype html><html><head></head><body></body></html>";
    const doc = new DOMParser().parseFromString(src, "text/html");
    shadowRef.current.replaceChildren(doc.documentElement);
  }, [html]);

  // cover 스케일 — 부모가 정수 반올림으로 완전한 2:3가 아니어도 빈틈 없이 채운다.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.max(w / REF_W, h / REF_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      onDragOver={
        onDropImageUrl
          ? (e) => {
              if (e.dataTransfer.types.includes("application/x-mag-url")) {
                e.preventDefault();
                setDropActive(true);
              }
            }
          : undefined
      }
      onDragLeave={onDropImageUrl ? () => setDropActive(false) : undefined}
      onDrop={onDropImageUrl ? handleDrop : undefined}
      className={`relative h-full w-full overflow-hidden bg-white ${className ?? ""}`}
    >
      <div
        ref={hostRef}
        style={{
          width: REF_W,
          height: REF_H,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          overflow: "hidden",
          background: "#fff",
          // 평소 none: 이벤트를 부모로 통과(썸네일 클릭·넘김·줌). 단, 드롭 대상 <img>를
          // elementFromPoint로 찾으려면 shadow 내부가 hit-test 대상이어야 하므로 드래그 중만 auto.
          pointerEvents: onDropImageUrl && dropActive ? "auto" : "none",
        }}
      />
      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-primary bg-primary/10" />
      )}
    </div>
  );
}

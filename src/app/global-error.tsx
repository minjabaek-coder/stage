"use client";

// 최후의 방어선. `error.tsx`는 루트 레이아웃 **안쪽**의 오류만 잡으므로, 레이아웃이나
// 폰트 로딩 단계에서 터지면 Next 기본 오류 화면이 나온다. 이 파일은 그 자리를 대신해
// 최소한 한국어 안내와 복귀 경로를 보여준다.
//
// 자기 자신이 또 터지면 의미가 없으므로 **외부 의존을 두지 않는다** — globals.css,
// 디자인 토큰, UI 컴포넌트, 폰트 모두 쓰지 않고 인라인 스타일만 쓴다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          background: "#faf8f4",
          color: "#1a1a1a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#a8842c",
          }}
        >
          STAGE
        </p>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          일시적인 오류가 발생했습니다
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#5c5c5c", maxWidth: 420, lineHeight: 1.7 }}>
          잠시 후 다시 시도해주세요. 계속 반복되면 문의해주시면 확인하겠습니다.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 11, color: "#9a9a9a" }}>
            오류 코드: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          {/* next/link가 아니라 일부러 `<a>`다 — 이 화면은 앱 셸이 이미 깨진 뒤에
              나타나므로, 클라이언트 라우팅으로 넘어가면 같은 깨진 트리로 되돌아갈
              수 있다. 전체 새로고침으로 처음부터 다시 받는 것이 목적이다. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              padding: "10px 20px",
              border: "1px solid #1a1a1a",
              color: "#1a1a1a",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textDecoration: "none",
            }}
          >
            홈으로
          </a>
        </div>
      </body>
    </html>
  );
}

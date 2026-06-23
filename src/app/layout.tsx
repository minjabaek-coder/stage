import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR, Noto_Sans_KR, DM_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";
import "./globals.css";

// 헤드라인: 한글 세리프 (로고·제목·표지 워드마크)
const notoSerifKR = Noto_Serif_KR({
  variable: "--font-headline",
  weight: ["300", "400", "600", "700", "900"],
  display: "swap",
  preload: false, // CJK 대용량 — 프리로드 비활성(한글 글리프는 사용 시 로드)
});

// 본문/UI: 한글 산세리프
const notoSansKR = Noto_Sans_KR({
  variable: "--font-body",
  weight: ["300", "400", "500", "700"],
  display: "swap",
  preload: false,
});

// 라벨/메타: 라틴 모노 (VOL.39 · AD · Sponsored 등)
const dmMono = DM_Mono({
  variable: "--font-label",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "STAGE",
    "스테이지",
    "문화예술",
    "공연",
    "전시",
    "클래식",
    "디지털 매거진",
    "AI 도슨트",
    "마에스트로",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${notoSansKR.variable} ${notoSerifKR.variable} ${dmMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

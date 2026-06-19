"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// 배경 이미지 오버레이 모드 설정 (MagazineArticle.layoutOptions JSONB).
export type ArticleLayout = {
  bgMode?: boolean;
  bgImageUrl?: string;
  bgDarkness?: number; // 0~90
  titleColor?: string;
  bodyColor?: string;
  labelColor?: string;
};

// ── Page model (built on the server from MagazineArticle rows) ──
export type EbookPage =
  | { kind: "cover" }
  | { kind: "toc" }
  | {
      kind: "article";
      slug: string;
      title: string;
      section: string | null;
      author: string | null;
      thumbnailUrl: string | null;
      html: string; // server-sanitized
      layout?: ArticleLayout | null;
    }
  | { kind: "maestro" };

export interface EbookMagazine {
  id: string;
  title: string;
  issueNumber: number;
  description: string | null;
  coverImageUrl: string | null;
  publishedLabel: string | null;
}

interface Props {
  magazine: EbookMagazine;
  pages: EbookPage[];
  initialIndex?: number;
}

function pageLabel(page: EbookPage, index: number): string {
  switch (page.kind) {
    case "cover":
      return "표지";
    case "toc":
      return "목차";
    case "maestro":
      return "AI 마에스트로";
    case "article":
      return page.title;
    default:
      return `${index + 1}`;
  }
}

export function MagazineEbookViewer({
  magazine,
  pages,
  initialIndex = 0,
}: Props) {
  const [current, setCurrent] = useState(initialIndex);
  const [tocOpen, setTocOpen] = useState(false);
  const total = pages.length;

  // Functional updaters keep these handlers stable (no stale-closure ref needed).
  const goTo = useCallback(
    (i: number) => setCurrent(Math.max(0, Math.min(total - 1, i))),
    [total]
  );
  const next = useCallback(
    () => setCurrent((p) => Math.min(total - 1, p + 1)),
    [total]
  );
  const prev = useCallback(() => setCurrent((p) => Math.max(0, p - 1)), []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") setTocOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    touchStartX.current = null;
  };

  const page = pages[current];
  const progress = total > 1 ? (current / (total - 1)) * 100 : 100;

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#fcf9f8] text-[#1c1b1b]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top bar + progress */}
      <header className="relative flex h-12 flex-shrink-0 items-center justify-between px-4">
        <Link
          href="/magazines"
          className="font-label text-xs uppercase tracking-[0.15em] text-[#6f5c24] hover:underline"
        >
          ← 목록
        </Link>
        <span className="font-label text-[11px] uppercase tracking-[0.2em] opacity-70">
          STAGE Vol.{magazine.issueNumber}
        </span>
        <span className="font-label text-[11px] tabular-nums opacity-60">
          {current + 1} / {total}
        </span>
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-[#6f5c24] transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </header>

      {/* Page area */}
      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Click zones (desktop) */}
        {current > 0 && (
          <button
            type="button"
            aria-label="이전 페이지"
            onClick={prev}
            className="absolute left-0 top-0 z-10 hidden h-full w-[12%] cursor-w-resize md:block"
          />
        )}
        {current < total - 1 && (
          <button
            type="button"
            aria-label="다음 페이지"
            onClick={next}
            className="absolute right-0 top-0 z-10 hidden h-full w-[12%] cursor-e-resize md:block"
          />
        )}

        {/* Sliding track */}
        <div
          className="flex h-full transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {pages.map((p, i) => (
            <div
              key={i}
              inert={i !== current}
              className="h-full w-full flex-shrink-0 overflow-y-auto"
            >
              <PageView page={p} magazine={magazine} active={i === current} />
            </div>
          ))}
        </div>
      </div>

      {/* Prev/Next buttons */}
      <div className="flex flex-shrink-0 items-center justify-center gap-6 py-2">
        <button
          type="button"
          onClick={prev}
          disabled={current === 0}
          className="font-label text-sm disabled:opacity-30"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={() => setTocOpen((v) => !v)}
          className="font-label text-[11px] uppercase tracking-[0.15em] text-[#6f5c24]"
        >
          목차
        </button>
        <button
          type="button"
          onClick={next}
          disabled={current === total - 1}
          className="font-label text-sm disabled:opacity-30"
        >
          다음 →
        </button>
      </div>

      {/* TOC drawer */}
      <button
        type="button"
        aria-label={tocOpen ? "목차 닫기" : "목차 열기"}
        onClick={() => setTocOpen((v) => !v)}
        className="flex-shrink-0 border-t border-[#1c1b1b]/10 bg-[#f3eeec] py-1.5 text-center font-label text-[10px] uppercase tracking-[0.2em] opacity-70"
      >
        {pageLabel(page, current)} {tocOpen ? "▾" : "▴"}
      </button>
      <div
        className={`flex-shrink-0 overflow-x-auto border-t border-[#1c1b1b]/10 bg-[#f3eeec] transition-all duration-300 motion-reduce:transition-none ${
          tocOpen ? "max-h-44 py-3" : "max-h-0 py-0"
        }`}
      >
        <div className="flex gap-3 px-4">
          {pages.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`w-32 flex-shrink-0 rounded border p-2 text-left transition-colors ${
                i === current
                  ? "border-[#6f5c24] bg-white"
                  : "border-[#1c1b1b]/10 bg-white/60 hover:border-[#1c1b1b]/30"
              } ${p.kind === "maestro" ? "ring-1 ring-[#6f5c24]/30" : ""}`}
            >
              <span className="font-label text-[9px] uppercase tracking-wider opacity-50">
                {String(i + 1).padStart(2, "0")}
                {p.kind === "article" && p.section ? ` · ${p.section}` : ""}
              </span>
              <span className="mt-1 line-clamp-2 font-headline text-xs leading-snug">
                {pageLabel(p, i)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Individual page renderers ──
function PageView({
  page,
  magazine,
  active,
}: {
  page: EbookPage;
  magazine: EbookMagazine;
  active: boolean;
}) {
  if (page.kind === "cover") {
    return (
      <div className="relative flex h-full min-h-full items-center justify-center overflow-hidden">
        {magazine.coverImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={magazine.coverImageUrl}
              alt={magazine.title}
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-[#fcf9f8]/40" />
          </>
        )}
        <div className="relative px-8 text-center">
          <span className="font-label text-xs uppercase tracking-[0.3em] text-[#6f5c24]">
            STAGE · Issue {String(magazine.issueNumber).padStart(2, "0")}
            {magazine.publishedLabel ? ` · ${magazine.publishedLabel}` : ""}
          </span>
          <h1 className="font-headline mt-6 text-5xl leading-tight tracking-tight md:text-7xl">
            {magazine.title}
          </h1>
          {magazine.description && (
            <p className="mx-auto mt-6 max-w-md text-[#444748] leading-relaxed">
              {magazine.description}
            </p>
          )}
          <span className="mt-10 block font-label text-[10px] uppercase tracking-[0.2em] opacity-40">
            넘기려면 → 또는 스와이프
          </span>
        </div>
      </div>
    );
  }

  if (page.kind === "toc") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-12">
        <h2 className="font-label text-xs font-black uppercase tracking-[0.25em] text-[#6f5c24]">
          목차 · Contents
        </h2>
        <div className="mt-2 font-headline text-3xl">{magazine.title}</div>
        <p className="mt-6 text-sm text-[#444748]">
          하단 <span className="text-[#6f5c24]">목차</span> 탭에서 원하는 섹션으로
          바로 이동할 수 있습니다.
        </p>
      </div>
    );
  }

  if (page.kind === "maestro") {
    return (
      <div className="mx-auto flex h-full min-h-full max-w-2xl flex-col justify-center px-8 py-12">
        <span className="font-label text-xs uppercase tracking-[0.25em] text-[#6f5c24]">
          AI 마에스트로
        </span>
        <h2 className="font-headline mt-3 text-4xl leading-tight">
          읽고, 묻고, 더 듣다
        </h2>
        <p className="mt-5 text-[#444748] leading-relaxed">
          이번 호 기사에 대해 궁금한 점을 AI 마에스트로에게 물어보세요. 작품
          배경, 작곡가, 공연 정보까지 STAGE가 학습한 콘텐츠로 답합니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {["이 작곡가에 대해 더 알려줘", "비슷한 공연 추천", "용어가 어려워요"].map(
            (q) => (
              <span
                key={q}
                className="rounded-full border border-[#6f5c24]/30 bg-white px-3 py-1.5 text-sm text-[#6f5c24]"
              >
                {q}
              </span>
            )
          )}
        </div>
        <p className="mt-6 font-label text-[10px] uppercase tracking-wider opacity-50">
          우측 하단 버튼으로 AI 마에스트로에게 바로 물어보세요
        </p>
      </div>
    );
  }

  // article — 배경 이미지 오버레이 모드
  const layout = page.layout;
  if (layout?.bgMode && layout.bgImageUrl) {
    const darkness = Math.max(0, Math.min(90, layout.bgDarkness ?? 60)) / 100;
    const titleColor = layout.titleColor || "#c4a35a";
    const bodyColor = layout.bodyColor || "#ffffff";
    const labelColor = layout.labelColor || "#ffffff";
    const proseStyle = {
      color: bodyColor,
      "--tw-prose-body": bodyColor,
      "--tw-prose-headings": titleColor,
      "--tw-prose-bold": bodyColor,
      "--tw-prose-links": titleColor,
      "--tw-prose-quotes": bodyColor,
      "--tw-prose-quote-borders": titleColor,
    } as React.CSSProperties;
    return (
      <article className="relative min-h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={layout.bgImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${darkness})` }}
        />
        <div className="relative mx-auto max-w-2xl px-8 py-12">
          <span
            className="font-label text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: labelColor }}
          >
            {page.section || "Article"}
          </span>
          <h2
            className="font-headline mt-3 text-3xl leading-tight tracking-tight md:text-4xl"
            style={{ color: titleColor }}
          >
            {page.title}
          </h2>
          {page.author && (
            <div
              className="mt-3 font-label text-xs font-semibold uppercase tracking-wider"
              style={{ color: labelColor }}
            >
              {page.author}
            </div>
          )}
          <div
            className="prose mt-8 max-w-none"
            style={proseStyle}
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
          <div className="mt-10">
            <Link
              href={`/magazines/${magazine.id}/${page.slug}`}
              className="font-label text-xs uppercase tracking-wider hover:underline"
              style={{ color: labelColor }}
              tabIndex={active ? 0 : -1}
            >
              전체 화면으로 읽기 →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  // article — 기본 텍스트 레이아웃
  return (
    <article className="mx-auto max-w-2xl px-8 py-12">
      <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f5c24]">
        {page.section || "Article"}
      </span>
      <h2 className="font-headline mt-3 text-3xl leading-tight tracking-tight md:text-4xl">
        {page.title}
      </h2>
      {page.author && (
        <div className="mt-3 font-label text-xs font-semibold uppercase tracking-wider text-[#444748]">
          {page.author}
        </div>
      )}
      {page.thumbnailUrl && (
        <div className="mt-6 overflow-hidden bg-[#eae7e7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.thumbnailUrl}
            alt={page.title}
            className="aspect-[3/2] w-full object-cover"
          />
        </div>
      )}
      <div
        className="prose prose-gray mt-8 max-w-none [&_p:first-of-type::first-letter]:float-left [&_p:first-of-type::first-letter]:mr-2 [&_p:first-of-type::first-letter]:font-headline [&_p:first-of-type::first-letter]:text-6xl [&_p:first-of-type::first-letter]:leading-[0.8] [&_p:first-of-type::first-letter]:text-[#6f5c24]"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
      <div className="mt-10">
        <Link
          href={`/magazines/${magazine.id}/${page.slug}`}
          className="font-label text-xs uppercase tracking-wider text-[#6f5c24] hover:underline"
          tabIndex={active ? 0 : -1}
        >
          전체 화면으로 읽기 →
        </Link>
      </div>
    </article>
  );
}

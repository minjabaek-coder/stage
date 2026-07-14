"use client";

// P1 공용 기사 선택기 — 평면 <select> 대체. 검색(제목·저자) + 필터(장르·미배치만) +
// 메타(썸네일·저자·발행일) + 배치 뱃지(이 매거진 P범위). 정렬: 미배치 우선 → 최신 발행.
// 팝오버는 document.body 포털 + fixed 위치라 오버플로 컨테이너에 잘리지 않는다.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTICLE_GENRES } from "@/lib/article-taxonomy";

export type ArticleOpt = {
  id: string;
  title: string;
  author?: string | null;
  genre?: string | null;
  subCategory?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null; // ISO
  status?: string | null;
};

// 이 매거진에서 기사가 차지한 연속 페이지 범위(articleId → {start,end}).
export type Placement = { start: number; end: number };

function rangeLabel(p: Placement): string {
  return p.start === p.end ? `P${p.start}` : `P${p.start}–${p.end}`;
}

const PANEL_W = 320;
const PANEL_MAXH = 380;

export function ArticlePicker({
  articles,
  placements,
  value,
  onChange,
  allowNone = false,
  placeholder = "기사 선택…",
  disabled = false,
  className = "",
}: {
  articles: ArticleOpt[];
  placements: Record<string, Placement>;
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [unplacedOnly, setUnplacedOnly] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>(
    { left: 0, top: 0 },
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8));
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow > PANEL_MAXH + 8) {
        setPos({ left, top: r.bottom + 4 });
      } else {
        setPos({ left, bottom: window.innerHeight - r.top + 4 });
      }
    }
    setOpen(true);
  }

  // 바깥 클릭 시 닫기(트리거·패널 모두 밖일 때). 패널은 포털이라 별도 ref 검사.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = articles.find((a) => a.id === value) ?? null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return articles
      .filter((a) => {
        if (genre && a.genre !== genre) return false;
        if (unplacedOnly && placements[a.id]) return false;
        if (needle) {
          const hay = `${a.title} ${a.author ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pa = placements[a.id] ? 1 : 0;
        const pb = placements[b.id] ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      });
  }, [articles, placements, q, genre, unplacedOnly]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        title="기사 선택"
        className="flex h-8 w-full items-center gap-1.5 rounded-md border bg-transparent px-2 text-left text-xs disabled:opacity-50"
      >
        <span className="truncate">
          {selected ? selected.title : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        {selected && placements[selected.id] && (
          <span className="ml-auto flex-none rounded bg-gold-deep/10 px-1 text-[10px] text-gold-deep">
            {rangeLabel(placements[selected.id])}
          </span>
        )}
        <span className="ml-auto flex-none text-muted-foreground">▾</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: PANEL_W,
              maxHeight: PANEL_MAXH,
            }}
            className="z-[100] flex flex-col rounded-lg border bg-popover p-2 shadow-lg"
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="제목·저자 검색"
              className="mb-2 h-8 w-full flex-none rounded-md border bg-transparent px-2 text-xs"
            />
            <div className="mb-2 flex flex-none items-center gap-1.5">
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="h-7 flex-1 rounded-md border bg-transparent px-1.5 text-[11px]"
              >
                <option value="">장르 전체</option>
                {ARTICLE_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <label className="flex flex-none items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={unplacedOnly}
                  onChange={(e) => setUnplacedOnly(e.target.checked)}
                  className="h-3 w-3"
                />
                미배치만
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {allowNone && (
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className="mb-1 block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
                >
                  기사 연동 없음
                </button>
              )}
              {rows.length === 0 && (
                <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                  조건에 맞는 기사가 없습니다
                </p>
              )}
              {rows.map((a) => {
                const p = placements[a.id];
                const meta = [a.genre, a.author, a.publishedAt?.slice(0, 10)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pick(a.id)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-left hover:bg-accent ${
                      a.id === value ? "bg-accent" : ""
                    }`}
                  >
                    <span className="h-9 w-12 flex-none overflow-hidden rounded bg-muted">
                      {a.thumbnailUrl && (
                        <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{a.title}</span>
                      {meta && (
                        <span className="block truncate text-[10px] text-muted-foreground">{meta}</span>
                      )}
                    </span>
                    {p ? (
                      <span className="flex-none rounded bg-gold-deep/10 px-1 text-[10px] text-gold-deep">
                        {rangeLabel(p)}
                      </span>
                    ) : a.status && a.status !== "published" ? (
                      <span className="flex-none rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        {a.status === "draft" ? "초안" : a.status}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

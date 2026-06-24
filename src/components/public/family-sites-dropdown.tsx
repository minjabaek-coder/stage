"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// 패밀리 사이트 선택기 (푸터 좌상단). StageOS=내부, Kairossebook=외부.
const SITES = [
  {
    name: "StageOS",
    desc: "문화예술 AI SaaS 플랫폼",
    href: "/stageos",
    external: false,
    mark: "✦",
    tone: "from-[#6366f1] to-[#8b5cf6]",
  },
  {
    name: "Kairossebook",
    desc: "AI 기반 독서 플랫폼",
    href: "https://kairossebook.com",
    external: true,
    mark: "📚",
    tone: "from-[#0891b2] to-[#0e7490]",
  },
];

export function FamilySitesDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 font-label text-[11px] uppercase tracking-wider text-white/55 transition-colors hover:border-white/30 hover:text-white/80"
      >
        패밀리 사이트
        <span
          className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-lg border border-white/10 bg-[#252423] shadow-xl"
        >
          {SITES.map((s) => {
            const inner = (
              <span className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-white/5">
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${s.tone} text-sm`}
                >
                  {s.mark}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-white">
                    {s.name}
                  </span>
                  <span className="block text-[11px] text-white/45">
                    {s.desc}
                  </span>
                </span>
                <span className="text-white/30">↗</span>
              </span>
            );
            return s.external ? (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="block"
                onClick={() => setOpen(false)}
              >
                {inner}
              </a>
            ) : (
              <Link
                key={s.name}
                href={s.href}
                role="menuitem"
                className="block"
                onClick={() => setOpen(false)}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

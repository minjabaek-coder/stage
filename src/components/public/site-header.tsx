"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderAuth } from "@/components/public/header-auth";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/magazines", label: "매거진" },
  { href: "/articles", label: "기사" },
  { href: "/culture-events", label: "문화예술" },
  { href: "/blog", label: "블로그" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          STAGE
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors hover:text-gray-900 ${
                pathname === item.href
                  ? "font-medium text-gray-900"
                  : "text-gray-500"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <HeaderAuth variant="default" />
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex sm:hidden h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="메뉴"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <nav className="border-t border-gray-100 bg-white sm:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-6 py-3 text-sm transition-colors hover:bg-gray-50 ${
                pathname === item.href
                  ? "font-medium text-gray-900"
                  : "text-gray-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <HeaderAuth variant="default" mobile />
        </nav>
      )}
    </header>
  );
}

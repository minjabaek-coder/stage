import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "STAGE Admin",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 운영 권한 게이트: 비-admin(비로그인 포함)은 404로 경로 자체를 은닉.
  const user = await getCurrentUser();
  if (user?.role !== "admin") notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="text-lg font-bold tracking-tight"
            >
              STAGE Admin
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/admin"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                대시보드
              </Link>
              <Link
                href="/admin/magazines"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                매거진
              </Link>
              <Link
                href="/admin/blog"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                블로그
              </Link>
              <Link
                href="/admin/articles"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                기사
              </Link>
              <Link
                href="/admin/culture-events"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                문화예술
              </Link>
              <Link
                href="/admin/contacts"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                문의
              </Link>
              <Link
                href="/admin/tips"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                제보
              </Link>
              <Link
                href="/admin/ads"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                광고
              </Link>
              <Link
                href="/admin/api-logs"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                API 로그
              </Link>
            </nav>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            사이트 보기
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

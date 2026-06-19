import { Suspense } from "react";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { GenreSubNav } from "@/components/public/genre-sub-nav";
import { RightSidebar } from "@/components/public/right-sidebar";

// 공개 콘텐츠 페이지 공용 셸: 헤더 + 장르탭 + 2컬럼(본문 + 우측 사이드바) + 푸터.
// 사이드바·장르탭은 목록/피드형 페이지에서 사용. 상세·전체화면 뷰어는 미사용.
export function MainLayout({
  children,
  showSidebar = true,
  showGenreNav = true,
}: {
  children: React.ReactNode;
  showSidebar?: boolean;
  showGenreNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      {showGenreNav && (
        <Suspense fallback={<div className="h-[41px] border-b border-gray-100" />}>
          <GenreSubNav />
        </Suspense>
      )}
      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-12">
        <main className="min-w-0 flex-1">{children}</main>
        {showSidebar && <RightSidebar />}
      </div>
      <Footer />
    </div>
  );
}

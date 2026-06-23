import { Suspense } from "react";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/public/site-header";
import { Footer } from "@/components/public/footer";
import { GenreSubNav } from "@/components/public/genre-sub-nav";
import { RightSidebar } from "@/components/public/right-sidebar";

// 공개 콘텐츠 페이지 공용 셸: 헤더 + (장르탭) + [좌측 레일] + 본문 + 우측 위젯 + 푸터.
// leftRail 전달 시 3컬럼(xl≥1280에서 노출). 사이드바·장르탭은 목록/피드형에서 사용.
export function MainLayout({
  children,
  showSidebar = true,
  showGenreNav = true,
  leftRail,
  sidebarHideRecent = false,
}: {
  children: ReactNode;
  showSidebar?: boolean;
  showGenreNav?: boolean;
  leftRail?: ReactNode;
  sidebarHideRecent?: boolean;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      {showGenreNav && (
        <Suspense fallback={<div className="h-[39px] border-b border-ink/10" />}>
          <GenreSubNav />
        </Suspense>
      )}
      <div className="mx-auto flex max-w-[1380px] gap-8 px-3 py-10 sm:px-8">
        {leftRail && (
          <aside className="hidden w-[200px] flex-shrink-0 xl:block">
            <div className="sticky top-[74px]">{leftRail}</div>
          </aside>
        )}
        <main className="min-w-0 flex-1">{children}</main>
        {showSidebar && <RightSidebar hideRecent={sidebarHideRecent} />}
      </div>
      <Footer />
    </div>
  );
}

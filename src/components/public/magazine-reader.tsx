"use client";

import { MagazineViewer } from "./magazine-viewer";
import type { MagazinePage, MagazineTocEntry } from "@/types/magazine";

// 단일 매거진 뷰어 셸(rev.3). 이전 flip/paged 이중 모드는 통합 뷰어로 수렴(결정 #10).
// 이미지형·구성형이 동일 뷰어를 공유 — 사용자에겐 구분 없는 하나의 "매거진 뷰어".
// 헤더(Issue·제목·닫기)·컨트롤은 뷰어가 소유. 조회수 추적은 page.tsx의 ViewTracker가 담당.
export function MagazineReader({
  pages,
  tocEntries = [],
  initialPage = 1,
  issueNumber,
  title,
}: {
  pages: MagazinePage[];
  tocEntries?: MagazineTocEntry[];
  initialPage?: number; // 1-based, ?page= 딥링크 진입 페이지
  issueNumber?: number;
  title?: string;
}) {
  return (
    <MagazineViewer
      pages={pages}
      tocEntries={tocEntries}
      initialPage={initialPage}
      issueNumber={issueNumber}
      title={title}
    />
  );
}

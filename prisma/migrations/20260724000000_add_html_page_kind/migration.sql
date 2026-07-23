-- 매거진 페이지 종류에 'html' 추가.
-- kind=html: 페이지 전체를 HTML로(iframe sandbox 렌더, RAG 색인 대상). 상세 docs/design/magazine-html-page.md.
-- enum 값 추가는 additive(기존 데이터·코드 무영향). 멱등(IF NOT EXISTS)으로 재실행 안전.
ALTER TYPE "MagazinePageKind" ADD VALUE IF NOT EXISTS 'html';

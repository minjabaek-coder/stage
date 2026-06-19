-- 매거진 아티클에 페이지 표시 설정(배경 이미지 오버레이 등) JSONB 컬럼 추가. 추가형(nullable).
ALTER TABLE "MagazineArticle" ADD COLUMN "layoutOptions" JSONB;

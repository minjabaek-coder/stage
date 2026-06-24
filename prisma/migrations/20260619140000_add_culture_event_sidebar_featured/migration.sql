-- 문화예술 이벤트를 홈 사이드바 티켓 위젯에 노출할지 큐레이션 플래그. 추가형(default false).
ALTER TABLE "CultureEvent" ADD COLUMN "sidebarFeatured" BOOLEAN NOT NULL DEFAULT false;

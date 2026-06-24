-- contentType enum에 composed 추가. 단독 마이그레이션(ADD VALUE는 사용 전 커밋되어야 안전).
ALTER TYPE "MagazineContentType" ADD VALUE IF NOT EXISTS 'composed';

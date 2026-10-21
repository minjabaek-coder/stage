-- Data API(PostgREST/supabase-js/GraphQL) 노출 차단 — anon·authenticated 권한 회수
--
-- 배경: Supabase 기본 설정은 public 스키마의 새 테이블에 anon·authenticated로
-- **full grant**(SELECT/INSERT/UPDATE/DELETE/TRUNCATE)를 자동으로 붙인다. 그래서
-- Prisma 마이그레이션으로 만든 22개 테이블 전부가 Data API로 라우팅 가능했고,
-- 막아주는 것은 **RLS 하나뿐**이었다(전 테이블 RLS ON + 정책 0 = deny all).
--
-- 단일 방어선이 문제다. 테이블 하나에서 RLS가 꺼지는 순간(새 테이블·수기 SQL·복구
-- 중 실수) 그 테이블은 즉시 외부에 읽기·쓰기 공개된다. 2026-10-10 프로젝트 소멸
-- 복구 중 실측으로 이 상태를 확인했다.
--
-- STAGE는 Data API를 **전혀 쓰지 않는다**(코드 전수 확인):
--   · DB 접근은 전부 Prisma = 직접 Postgres 연결, `postgres` 역할 → 이 회수와 무관
--   · supabase-js는 Auth(`/auth/v1`, auth 스키마)와 Storage(`/storage/v1`, storage
--     스키마)에만 쓴다. 모든 `.from()`이 스토리지 버킷이고 `.rpc()`는 0건
--   · Realtime 미사용
-- 따라서 권한을 회수해도 앱 동작은 바뀌지 않고, PostgREST가 `200 []` 대신
-- `permission denied`를 반환하게 될 뿐이다.
--
-- 왜 대시보드 설정이 아니라 마이그레이션인가: 2026-10-10에 Supabase 프로젝트가
-- 통째로 사라져 **스키마를 마이그레이션으로 재생성**했다. 대시보드 설정은 그때
-- 함께 사라진다. 스키마의 정본은 이 디렉토리이므로 보안 설정도 여기에 둔다.
--
-- Supabase는 2026-10-30부터 신규 테이블 자동 grant를 중단한다고 공지했다. 이
-- 마이그레이션은 **그 이전에 만들어진 기존 22개 테이블**을 처리하고, 공지 적용
-- 시점·범위에 의존하지 않도록 기본 권한까지 직접 끊는다.
--
-- 멱등: REVOKE는 없는 권한을 회수해도 성공한다. 재실행 안전.

-- ① 기존 테이블 — 22개 전부
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ② 앞으로 postgres(= Prisma 마이그레이션 실행 역할)가 만드는 테이블
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

-- 건드리지 않는 것 (의도적):
--  · service_role — 서버 전용 비밀키(SUPABASE_SERVICE_ROLE_KEY)로만 쓰이고
--    브라우저에 노출되지 않는다. 스토리지 경로가 이 역할을 쓰므로 보수적으로 유지.
--  · postgres — Prisma가 쓰는 역할. 끊으면 앱이 죽는다.
--  · FUNCTIONS/SEQUENCES — public에 `pg_trgm`·`vector` 확장이 설치돼 함수가 150개
--    있다. 데이터 노출 경로가 아니고, 확장 함수 권한을 건드리면 영향 범위가 불필요하게
--    넓어진다. 노출 벡터는 테이블이다.

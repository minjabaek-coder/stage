-- Phase 1.5: 계정 권한(role)·기사 상태(ArticleStatus)·기고자 편집 토큰 스키마.
-- 운영 공유 DB·풀러 → raw SQL(tsx)로 적용 후 _prisma_migrations 체크섬 등록.
-- ArticleStatus는 enum 전환(draft/published 기존값 유지 + submitted 신규).

CREATE TYPE "ArticleStatus" AS ENUM ('draft', 'submitted', 'published');
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- Article.status: BlogPostStatus → ArticleStatus (USING 캐스트, 기존값 매핑)
ALTER TABLE "Article" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Article" ALTER COLUMN "status" TYPE "ArticleStatus" USING ("status"::text::"ArticleStatus");
ALTER TABLE "Article" ALTER COLUMN "status" SET DEFAULT 'draft';

-- User.role 추가
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user';

-- 기고자 편집 토큰
CREATE TABLE "ArticleEditToken" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ArticleEditToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArticleEditToken_articleId_key" ON "ArticleEditToken"("articleId");
CREATE UNIQUE INDEX "ArticleEditToken_tokenHash_key" ON "ArticleEditToken"("tokenHash");
ALTER TABLE "ArticleEditToken" ADD CONSTRAINT "ArticleEditToken_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

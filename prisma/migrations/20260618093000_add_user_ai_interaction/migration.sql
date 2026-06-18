-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('guest', 'member', 'pro');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT,
    "snsProvider" TEXT,
    "tier" "UserTier" NOT NULL DEFAULT 'member',
    "interests" TEXT[],
    "proExpiresAt" TIMESTAMP(3),
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "eventAlertOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "magazineId" TEXT,
    "articleId" TEXT,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AiInteraction_userId_createdAt_idx" ON "AiInteraction"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AiInteraction_sessionId_idx" ON "AiInteraction"("sessionId");

-- AddForeignKey
ALTER TABLE "AiInteraction" ADD CONSTRAINT "AiInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

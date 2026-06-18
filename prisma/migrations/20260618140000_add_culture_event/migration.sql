-- CreateTable
CREATE TABLE "CultureEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '공연',
    "genre" TEXT[],
    "venue" TEXT NOT NULL DEFAULT '',
    "address" TEXT,
    "artists" TEXT[],
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "ticketUrl" TEXT,
    "ticketPrice" TEXT,
    "memberDiscount" INTEGER NOT NULL DEFAULT 0,
    "eduInstructor" TEXT,
    "eduSchedule" TEXT,
    "maxParticipants" INTEGER,
    "applyUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CultureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CultureEvent_slug_key" ON "CultureEvent"("slug");

-- CreateIndex
CREATE INDEX "CultureEvent_status_startDate_idx" ON "CultureEvent"("status", "startDate");

-- CreateIndex
CREATE INDEX "CultureEvent_type_idx" ON "CultureEvent"("type");

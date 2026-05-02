-- CreateEnum
CREATE TYPE "PublicPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "PublicPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "status" "PublicPostStatus" NOT NULL DEFAULT 'DRAFT',
    "coverImageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "journeyId" TEXT,
    "stopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicPost_slug_key" ON "PublicPost"("slug");

-- CreateIndex
CREATE INDEX "PublicPost_status_publishedAt_idx" ON "PublicPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicPost_journeyId_idx" ON "PublicPost"("journeyId");

-- CreateIndex
CREATE INDEX "PublicPost_stopId_idx" ON "PublicPost"("stopId");

-- AddForeignKey
ALTER TABLE "PublicPost" ADD CONSTRAINT "PublicPost_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPost" ADD CONSTRAINT "PublicPost_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ExternalMediaPlatform" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'GENERIC');

-- CreateEnum
CREATE TYPE "ExternalMediaEntityType" AS ENUM ('Tour', 'TRIP', 'MOMENT', 'STORY');

-- CreateTable
CREATE TABLE "ExternalMediaLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "entityType" "ExternalMediaEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platform" "ExternalMediaPlatform" NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "thumbnailUrl" TEXT,
    "embedUrl" TEXT,
    "externalId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMediaLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalMediaLink_workspaceId_entityType_entityId_deletedAt_idx" ON "ExternalMediaLink"("workspaceId", "entityType", "entityId", "deletedAt");

-- CreateIndex
CREATE INDEX "ExternalMediaLink_workspaceId_platform_deletedAt_idx" ON "ExternalMediaLink"("workspaceId", "platform", "deletedAt");

-- CreateIndex
CREATE INDEX "ExternalMediaLink_createdByUserId_deletedAt_idx" ON "ExternalMediaLink"("createdByUserId", "deletedAt");

-- AddForeignKey
ALTER TABLE "ExternalMediaLink" ADD CONSTRAINT "ExternalMediaLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMediaLink" ADD CONSTRAINT "ExternalMediaLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

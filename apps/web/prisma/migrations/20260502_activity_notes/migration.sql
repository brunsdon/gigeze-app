-- Replace the dev-only WorkSession concept with dashboard-private ActivityNote records.
CREATE TYPE "ActivityType" AS ENUM ('WORK', 'MAINTENANCE', 'ADMIN', 'PERSONAL');

CREATE TABLE "ActivityNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "stopId" TEXT,
    "type" "ActivityType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "location" TEXT,
    "notes" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityNote_workspaceId_date_idx" ON "ActivityNote"("workspaceId", "date");
CREATE INDEX "ActivityNote_journeyId_date_idx" ON "ActivityNote"("journeyId", "date");
CREATE INDEX "ActivityNote_stopId_date_idx" ON "ActivityNote"("stopId", "date");
CREATE INDEX "ActivityNote_workspaceId_visibility_idx" ON "ActivityNote"("workspaceId", "visibility");
CREATE INDEX "ActivityNote_type_date_idx" ON "ActivityNote"("type", "date");

ALTER TABLE "ActivityNote" ADD CONSTRAINT "ActivityNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityNote" ADD CONSTRAINT "ActivityNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityNote" ADD CONSTRAINT "ActivityNote_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityNote" ADD CONSTRAINT "ActivityNote_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "WorkSession";

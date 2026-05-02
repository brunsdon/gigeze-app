ALTER TABLE "DrivingLog" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "DrivingLog_workspaceId_deletedAt_idx" ON "DrivingLog"("workspaceId", "deletedAt");

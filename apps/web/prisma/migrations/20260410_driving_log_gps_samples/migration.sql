CREATE TABLE "DrivingLogGpsSample" (
  "id" TEXT NOT NULL,
  "drivingLogId" TEXT NOT NULL,
  "sampleIndex" INTEGER NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "accuracyMeters" INTEGER,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DrivingLogGpsSample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DrivingLogGpsSample_drivingLogId_sampleIndex_key"
ON "DrivingLogGpsSample"("drivingLogId", "sampleIndex");

CREATE INDEX "DrivingLogGpsSample_drivingLogId_recordedAt_idx"
ON "DrivingLogGpsSample"("drivingLogId", "recordedAt");

ALTER TABLE "DrivingLogGpsSample"
ADD CONSTRAINT "DrivingLogGpsSample_drivingLogId_fkey"
FOREIGN KEY ("drivingLogId") REFERENCES "DrivingLog"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

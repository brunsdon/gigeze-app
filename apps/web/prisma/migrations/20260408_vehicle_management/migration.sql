-- Add isDefault and startingOdometer to Vehicle
ALTER TABLE "Vehicle"
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "startingOdometer" INTEGER NOT NULL DEFAULT 0;

-- Add optional vehicleId to DrivingLog (nullable for backward compatibility)
ALTER TABLE "DrivingLog"
  ADD COLUMN "vehicleId" TEXT;

ALTER TABLE "DrivingLog"
  ADD CONSTRAINT "DrivingLog_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DrivingLog_vehicleId_idx" ON "DrivingLog"("vehicleId");

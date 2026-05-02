-- Create LogUseType enum
CREATE TYPE "LogUseType" AS ENUM ('BUSINESS', 'PERSONAL');

-- Add gpsSamplingIntervalSeconds to Workspace
ALTER TABLE "Workspace"
  ADD COLUMN "gpsSamplingIntervalSeconds" INTEGER NOT NULL DEFAULT 15;

-- Add defaultUse to Vehicle
ALTER TABLE "Vehicle"
  ADD COLUMN "defaultUse" "LogUseType" NOT NULL DEFAULT 'PERSONAL';

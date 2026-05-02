-- AlterTable
ALTER TABLE "Workspace"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "defaultJourneyVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "defaultPostVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "defaultMediaVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

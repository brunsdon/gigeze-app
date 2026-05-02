ALTER TABLE "DrivingLog"
ADD COLUMN "startLatitude" DECIMAL(9, 6),
ADD COLUMN "startLongitude" DECIMAL(9, 6),
ADD COLUMN "endLatitude" DECIMAL(9, 6),
ADD COLUMN "endLongitude" DECIMAL(9, 6),
ADD COLUMN "startPlaceId" TEXT,
ADD COLUMN "endPlaceId" TEXT,
ADD COLUMN "startFormattedAddress" TEXT,
ADD COLUMN "endFormattedAddress" TEXT;

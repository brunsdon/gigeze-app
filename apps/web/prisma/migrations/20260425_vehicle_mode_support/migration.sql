CREATE TYPE "VehicleMode" AS ENUM ('RIDE', 'DRIVE');

ALTER TABLE "Vehicle"
ADD COLUMN "vehicleMode" "VehicleMode" NOT NULL DEFAULT 'DRIVE';

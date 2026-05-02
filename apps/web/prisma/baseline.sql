-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PUBLIC');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "JourneyStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "PublicPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registration" TEXT,
    "fuelType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tour" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "JourneyStatus" NOT NULL DEFAULT 'PLANNED',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Gig" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "locationName" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "departureDate" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PublicPost" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "DrivingLog" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startLocation" TEXT,
    "endLocation" TEXT,
    "startOdometer" INTEGER NOT NULL,
    "endOdometer" INTEGER NOT NULL,
    "businessKm" INTEGER NOT NULL DEFAULT 0,
    "personalKm" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrivingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkSession" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Media" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT,
    "stopId" TEXT,
    "filePath" TEXT NOT NULL,
    "publicUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Journey_slug_key" ON "Tour"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Journey_isPublic_idx" ON "Tour"("isPublic");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Journey_status_idx" ON "Tour"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Journey_startDate_idx" ON "Tour"("startDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Stop_journeyId_orderIndex_idx" ON "Gig"("journeyId", "orderIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Stop_journeyId_isPublic_idx" ON "Gig"("journeyId", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PublicPost_slug_key" ON "PublicPost"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicPost_status_publishedAt_idx" ON "PublicPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicPost_journeyId_idx" ON "PublicPost"("journeyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PublicPost_stopId_idx" ON "PublicPost"("stopId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DrivingLog_journeyId_date_idx" ON "DrivingLog"("journeyId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DrivingLog_date_idx" ON "DrivingLog"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkSession_journeyId_date_idx" ON "WorkSession"("journeyId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkSession_date_idx" ON "WorkSession"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Media_journeyId_idx" ON "Media"("journeyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Media_stopId_idx" ON "Media"("stopId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Media_isPublic_idx" ON "Media"("isPublic");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "Gig" ADD CONSTRAINT "Stop_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "PublicPost" ADD CONSTRAINT "PublicPost_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "PublicPost" ADD CONSTRAINT "PublicPost_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "DrivingLog" ADD CONSTRAINT "DrivingLog_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "Media" ADD CONSTRAINT "Media_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "Media" ADD CONSTRAINT "Media_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Gig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;


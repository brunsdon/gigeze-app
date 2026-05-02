-- Create workspace and access-control enums.
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'VIEWER');
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- Create workspace collaboration tables.
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- Add workspace and visibility columns to existing entities.
ALTER TABLE "User"
    ADD COLUMN "supabaseAuthUserId" TEXT;

ALTER TABLE "Vehicle"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "userId" TEXT;

ALTER TABLE "Tour"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "createdByUserId" TEXT,
    ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

ALTER TABLE "Gig"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "createdByUserId" TEXT,
    ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

ALTER TABLE "PublicPost"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "createdByUserId" TEXT,
    ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

ALTER TABLE "DrivingLog"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "createdByUserId" TEXT;

ALTER TABLE "WorkSession"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "createdByUserId" TEXT;

ALTER TABLE "Media"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "createdByUserId" TEXT,
    ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- Create one workspace per user lazily at migration time for existing users.
INSERT INTO "Workspace" ("id", "slug", "name", "ownerUserId", "updatedAt")
SELECT
    'ws_' || u."id",
    'workspace-' || substring(u."id" FROM 1 FOR 8),
    COALESCE(NULLIF(TRIM(u."fullName"), ''), split_part(u."email", '@', 1) || '''s Workspace'),
    u."id",
    CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1
    FROM "Workspace" w
    WHERE w."ownerUserId" = u."id"
);

-- Ensure each workspace has an owner membership.
INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "updatedAt")
SELECT
    'wsm_' || w."id",
    w."id",
    w."ownerUserId",
    'OWNER'::"WorkspaceRole",
    CURRENT_TIMESTAMP
FROM "Workspace" w
WHERE NOT EXISTS (
    SELECT 1
    FROM "WorkspaceMember" m
    WHERE m."workspaceId" = w."id"
      AND m."userId" = w."ownerUserId"
);

-- Resolve legacy owner for existing single-admin data.
WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "Tour" j
SET
    "workspaceId" = ow."workspaceId",
    "createdByUserId" = ow."ownerUserId",
    "visibility" = CASE WHEN j."isPublic" THEN 'PUBLIC'::"Visibility" ELSE 'PRIVATE'::"Visibility" END
FROM owner_workspace ow
WHERE j."workspaceId" IS NULL;

WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "Gig" s
SET
    "workspaceId" = COALESCE((
        SELECT j."workspaceId"
        FROM "Tour" j
        WHERE j."id" = s."journeyId"
    ), ow."workspaceId"),
    "createdByUserId" = ow."ownerUserId",
    "visibility" = CASE WHEN s."isPublic" THEN 'PUBLIC'::"Visibility" ELSE 'PRIVATE'::"Visibility" END
FROM owner_workspace ow
WHERE s."workspaceId" IS NULL;

WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "PublicPost" p
SET
    "workspaceId" = COALESCE(
        (
            SELECT j."workspaceId"
            FROM "Tour" j
            WHERE j."id" = p."journeyId"
        ),
        (
            SELECT s."workspaceId"
            FROM "Gig" s
            WHERE s."id" = p."stopId"
        ),
        ow."workspaceId"
    ),
    "createdByUserId" = ow."ownerUserId",
    "visibility" = CASE
        WHEN p."status" = 'PUBLISHED' THEN 'PUBLIC'::"Visibility"
        ELSE 'PRIVATE'::"Visibility"
    END
FROM owner_workspace ow
WHERE p."workspaceId" IS NULL;

WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "DrivingLog" d
SET
    "workspaceId" = COALESCE((
        SELECT j."workspaceId"
        FROM "Tour" j
        WHERE j."id" = d."journeyId"
    ), ow."workspaceId"),
    "createdByUserId" = ow."ownerUserId"
FROM owner_workspace ow
WHERE d."workspaceId" IS NULL;

WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "WorkSession" ws
SET
    "workspaceId" = COALESCE((
        SELECT j."workspaceId"
        FROM "Tour" j
        WHERE j."id" = ws."journeyId"
    ), ow."workspaceId"),
    "createdByUserId" = ow."ownerUserId"
FROM owner_workspace ow
WHERE ws."workspaceId" IS NULL;

WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "Media" m
SET
    "workspaceId" = COALESCE(
        (
            SELECT j."workspaceId"
            FROM "Tour" j
            WHERE j."id" = m."journeyId"
        ),
        (
            SELECT s."workspaceId"
            FROM "Gig" s
            WHERE s."id" = m."stopId"
        ),
        ow."workspaceId"
    ),
    "createdByUserId" = ow."ownerUserId",
    "visibility" = CASE WHEN m."isPublic" THEN 'PUBLIC'::"Visibility" ELSE 'PRIVATE'::"Visibility" END
FROM owner_workspace ow
WHERE m."workspaceId" IS NULL;

WITH legacy_owner AS (
    SELECT u."id"
    FROM "User" u
    ORDER BY CASE WHEN u."role" = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" ASC
    LIMIT 1
), owner_workspace AS (
    SELECT w."id" AS "workspaceId", w."ownerUserId"
    FROM "Workspace" w
    JOIN legacy_owner lo ON lo."id" = w."ownerUserId"
)
UPDATE "Vehicle" v
SET
    "workspaceId" = ow."workspaceId",
    "userId" = ow."ownerUserId"
FROM owner_workspace ow
WHERE v."workspaceId" IS NULL;

-- Enforce NOT NULL after backfill.
ALTER TABLE "Vehicle"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Tour"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL;

ALTER TABLE "Gig"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL;

ALTER TABLE "PublicPost"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL;

ALTER TABLE "DrivingLog"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL;

ALTER TABLE "WorkSession"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL;

ALTER TABLE "Media"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "createdByUserId" SET NOT NULL;

-- Add uniqueness and secondary indexes.
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE UNIQUE INDEX "Workspace_ownerUserId_key" ON "Workspace"("ownerUserId");
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation"("token");
CREATE UNIQUE INDEX "User_supabaseAuthUserId_key" ON "User"("supabaseAuthUserId");

CREATE INDEX "Workspace_ownerUserId_idx" ON "Workspace"("ownerUserId");
CREATE INDEX "WorkspaceMember_userId_role_idx" ON "WorkspaceMember"("userId", "role");
CREATE INDEX "WorkspaceInvitation_workspaceId_status_idx" ON "WorkspaceInvitation"("workspaceId", "status");
CREATE INDEX "WorkspaceInvitation_email_status_idx" ON "WorkspaceInvitation"("email", "status");
CREATE INDEX "Vehicle_workspaceId_idx" ON "Vehicle"("workspaceId");
CREATE INDEX "Journey_workspaceId_visibility_idx" ON "Tour"("workspaceId", "visibility");
CREATE INDEX "Stop_workspaceId_journeyId_visibility_idx" ON "Gig"("workspaceId", "journeyId", "visibility");
CREATE INDEX "PublicPost_workspaceId_visibility_idx" ON "PublicPost"("workspaceId", "visibility");
CREATE INDEX "DrivingLog_workspaceId_date_idx" ON "DrivingLog"("workspaceId", "date");
CREATE INDEX "WorkSession_workspaceId_date_idx" ON "WorkSession"("workspaceId", "date");
CREATE INDEX "Media_workspaceId_visibility_idx" ON "Media"("workspaceId", "visibility");
CREATE INDEX "Media_workspaceId_idx" ON "Media"("workspaceId");

-- Replace old boolean visibility columns and legacy role.
DROP INDEX IF EXISTS "Journey_isPublic_idx";
DROP INDEX IF EXISTS "Stop_journeyId_isPublic_idx";
DROP INDEX IF EXISTS "Media_isPublic_idx";

ALTER TABLE "Tour" DROP COLUMN "isPublic";
ALTER TABLE "Gig" DROP COLUMN "isPublic";
ALTER TABLE "Media" DROP COLUMN "isPublic";
ALTER TABLE "User" DROP COLUMN "role";

DROP TYPE "UserRole";

-- Add foreign keys.
ALTER TABLE "Workspace"
    ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
    ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvitation"
    ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "WorkspaceInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vehicle"
    ADD CONSTRAINT "Vehicle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tour"
    ADD CONSTRAINT "Journey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Journey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Gig"
    ADD CONSTRAINT "Stop_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Stop_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicPost"
    ADD CONSTRAINT "PublicPost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "PublicPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrivingLog"
    ADD CONSTRAINT "DrivingLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "DrivingLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkSession"
    ADD CONSTRAINT "WorkSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "WorkSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media"
    ADD CONSTRAINT "Media_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "Media_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

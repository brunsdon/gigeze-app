# API Overview

This is a concise map of the important API surface. It is not OpenAPI documentation; the request and response shapes below are summarized from route handlers and shared/mobile types.

## Auth Assumptions

Mobile API routes expect a Supabase access token in an `Authorization: Bearer <token>` header. The server validates that token and maps it to the current user and owned workspace in `apps/web/src/app/api/mobile/auth.ts`.

Browser/dashboard routes use the app's server-side auth helpers such as `requireAuthenticatedUser` and `requireWorkspaceOwner`.

## Mobile Tour Data

Files:

- `apps/web/src/app/api/mobile/tours/route.ts`
- `apps/web/src/app/api/mobile/tours/[tourId]/route.ts`

Endpoints:

- `GET /api/mobile/tours` returns `{ Tours: [...] }` for the authenticated workspace.
- `POST /api/mobile/tours` validates `journeyCreateSchema` and creates a tour.
- `PUT /api/mobile/tours/[tourId]` validates `journeyUpdateSchema` and updates a tour.
- `DELETE /api/mobile/tours/[tourId]` deletes a tour in the authenticated workspace.

The serialized tour shape includes id, title, description, start/end dates, status, visibility, and cover image URL.

There is no dedicated mobile gig CRUD endpoint in the current scaffold. Gigs are modeled in Prisma and managed through the web feature/service layer; mobile trip capture links to tours and persists completed field activity as driving logs.

## Mobile Vehicle Data

Files:

- `apps/web/src/app/api/mobile/vehicles/route.ts`
- `apps/web/src/app/api/mobile/vehicles/[vehicleId]/route.ts`

Endpoints list, create, update, and delete vehicles for mobile flows. The list response includes vehicle mode, default use, business split setting, registration/fuel/notes, starting odometer, default flag, and latest odometer.

## Mobile Trip Data

Files:

- `apps/web/src/app/api/mobile/trips/route.ts`
- `apps/web/src/app/api/mobile/trips/[tripId]/route.ts`
- `apps/web/src/app/api/mobile/trips/deletions/route.ts`

Endpoints:

- `GET /api/mobile/trips` returns recent backend driving-log summaries for mobile reconciliation.
- `DELETE /api/mobile/trips/[tripId]` soft-deletes a backend driving log.
- `GET /api/mobile/trips/deletions` returns backend deleted-trip tombstones for mobile reconciliation.

## Completed-Trip Sync

Files:

- `apps/mobile/src/features/trips/mobile-sync/sync-client.ts`
- `apps/web/src/app/api/trips/complete/route.ts`
- `apps/web/src/features/driving-logs/service.ts`

Endpoint:

- `POST /api/trips/complete`

The mobile payload includes optional mobile/backend trip ids, optional tour and vehicle references, trip mode, purpose/odometer metadata, start/end timestamps, distance, GPS samples, downsampled route polyline, and stop suggestions. The route validates the payload with Zod, validates the Supabase bearer token or current web session, persists a `DrivingLog`, appends GPS samples, and returns `draftLogId`, `editHref`, and `distanceKm`.

## Media Upload

Files:

- `apps/web/src/app/api/media/upload/route.ts`
- `apps/web/src/features/media/supabase-storage-service.ts`
- `apps/web/src/features/media/service.ts`

Endpoint:

- `POST /api/media/upload`

This route expects multipart form data with `file` and optional `bucket`, `folder`, `journeyId`, `stopId`, `caption`, and `visibility`. It validates the file, uploads it to the configured Supabase Storage bucket, and creates `Media` metadata in Prisma.

## Quick-Entry Sync

Files:

- `apps/web/src/app/api/quick-entry/sync/route.ts`
- `apps/web/src/features/quick-entry/offline-contract.ts`

Endpoint:

- `POST /api/quick-entry/sync`

This route accepts queued offline quick-entry actions and processes supported create actions for gigs, driving logs, activity notes, and media metadata. It returns `successIds` plus per-item failures. The in-memory processed-id cache prevents repeated queue ids from being handled twice during the current server process lifetime.

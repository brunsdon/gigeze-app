# Walkthrough: Mobile Trip Capture to Web Dashboard Review

This is the flagship reviewer path because it crosses mobile UI, local state, shared contracts, API design, validation, persistence, and web review.

## What the User Does

1. Signs into the Expo mobile app.
2. Starts a trip from the mobile trip workflow, optionally tied to a tour, vehicle, trip mode, purpose, and odometer metadata.
3. Lets the app collect tracking samples while the trip is active.
4. Completes the trip.
5. Opens the web dashboard to review the generated driving log draft.

## What the Mobile App Stores

The mobile app stores active and completed trips in AsyncStorage through `apps/mobile/src/features/trips/trip-storage.ts`. Active trips are saved under a user-specific active key. Completed trips are saved in recent trip history and receive `syncState: "pendingSync"` when completed by `completeLocalTripSession` in `apps/mobile/src/features/trips/trip-workflow.ts`.

Tracking samples are collected separately through the mobile tracking/sample store. When sync runs, `TripProvider` loads the completed trip plus samples and passes both into `syncCompletedTripToBackend`.

Key files:

- `apps/mobile/src/features/trips/trip-state.tsx`
- `apps/mobile/src/features/trips/trip-storage.ts`
- `apps/mobile/src/features/trips/trip-workflow.ts`
- `apps/mobile/src/features/trips/mobile-tracking/sample-store.ts`
- `apps/mobile/src/features/trips/mobile-sync/sync-client.ts`

## What the API Route Receives

`mapCompletedTripToPayload` in `apps/mobile/src/features/trips/mobile-sync/sync-client.ts` builds the request body for `POST /api/trips/complete`.

The payload includes:

- local `mobileTripId` and optional existing `backendTripId`
- optional `journeyId` and `journeyTitle`
- `tripMode`, optional `vehicleId`, business/private purpose, and odometer metadata
- `startedAt`, `endedAt`, and computed `distanceKm`
- raw GPS `samples`
- downsampled `routePolyline`
- stop suggestions, currently sent as an empty array by the mobile mapper

The mobile client sends the Supabase access token as a bearer token.

## Server-Side Validation and Persistence

`apps/web/src/app/api/trips/complete/route.ts` validates the incoming JSON with a Zod schema, resolves the user/workspace from the bearer token, and checks that vehicle and trip mode combinations are valid.

Persistence happens through the driving-log service:

- Existing backend trip ids are updated when present.
- Existing drafts can be matched by `mobileTripId` to avoid duplicate completed-trip rows.
- New completed trips create a `DrivingLog`.
- GPS samples create `DrivingLogGpsSample` rows.
- The response includes `draftLogId`, `editHref`, and `distanceKm`.

Key files:

- `apps/web/src/app/api/trips/complete/route.ts`
- `apps/web/src/features/driving-logs/service.ts`
- `apps/web/prisma/schema.prisma`

## Web Dashboard Review

After sync, the mobile trip stores the backend id and edit URL locally. On the web side, reviewers can inspect the persisted result in:

- `/dashboard/logs/driving`
- `/dashboard/logs/driving/[logId]/edit`

Relevant web files:

- `apps/web/src/app/(app)/dashboard/logs/driving/page.tsx`
- `apps/web/src/app/(app)/dashboard/logs/driving/[logId]/edit/page.tsx`
- `apps/web/src/components/driving-logs/expandable-trip-logs-table.tsx`

## Why This Demonstrates Full-Stack Engineering

This flow shows more than a static CRUD demo. It handles local mobile state, background/location sample capture, retryable sync states, authenticated API ingestion, server-side validation, duplicate prevention, relational persistence, soft deletes, dashboard review, and shared TypeScript contracts. The implementation is still a demo scaffold, but it demonstrates the shape of production-grade thinking without claiming finished SaaS readiness.

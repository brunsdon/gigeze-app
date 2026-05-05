# Demo Data

GigEze includes a repeatable seed for the Neon Vultures portfolio dataset.

Only run against a database where demo data is acceptable.

## Neon Vultures Seed

Run from the repository root:

```bash
npm run db:seed:gigeze-demo
```

To intentionally target the production Supabase/PostgreSQL env file from this checkout:

```bash
npm run db:seed:gigeze-demo:prod
```

The default script loads `apps/web/.env` when `DATABASE_URL` is not already present in the process environment. The production convenience script loads `apps/web/.env.production.local`. Either way, an explicitly exported `DATABASE_URL` takes precedence. It writes demo/portfolio data to whichever database that URL targets.

The seed attaches the dataset to `brunsdon@engineer.com`. If that user already exists, it is reused. If the user has an owned workspace, that workspace is reused. Otherwise the script creates a deterministic personal workspace with slug `brunsdon-engineer`.

The script creates or updates:

- The public active tour `neon-vultures-east-coast-run-2026`.
- 10 public gigs for the east coast run.
- 10 activity notes distributed across the gigs.
- 5 driving logs with plausible sequential odometer values and compact GPS waypoint samples for route preview maps.
- A demo tour vehicle used by the driving logs.
- 4 tour stories: 3 published/shared-or-public posts and 1 private draft.
- The public planned tour `neon-vultures-tasmania-circuit-2026`.
- 6 Tasmania gigs, 6 activity notes, 4 driving logs with GPS waypoint samples, and 3 Tasmania tour stories.

The seed is idempotent. It uses the unique tour slug and stable demo IDs for records that do not have natural unique keys in the Prisma schema.

## Intentional Skips

Gig status is stored in each gig description because the current `Gig` model has no status field.

Media rows are intentionally skipped. The current `Media` model requires `filePath`, and app display code can resolve that path into Supabase storage URLs. Creating placeholder paths without real storage objects would create broken media URLs.

Mobile sync state is intentionally skipped for driving logs because the current `DrivingLog` model has no sync-state field.

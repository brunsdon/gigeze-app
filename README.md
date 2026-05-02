# GigEze

GigEze is a demo monorepo for tour managers who need one place to plan tours, manage gigs, capture mobile trip activity, and publish selected tour moments.

The project is adapted from a production-style travel app architecture and reworked around entertainment operations: tours, gigs, acts, media, notes, public pages, and mobile field capture.

## Why This Exists

This repository is intended as a public portfolio project. It demonstrates:

- Full-stack monorepo architecture with shared TypeScript contracts.
- Next.js dashboard and public web surfaces.
- Prisma data modeling for authenticated workspace workflows.
- Supabase auth/storage integration points.
- Expo React Native mobile app structure.
- Local-first mobile trip capture with completed-trip sync.
- Practical product thinking for a niche operations tool.

## Product Concept

GigEze helps a tour manager coordinate the operational record around live entertainment work.

Core concepts:

- `Tour`: the parent plan for a run of shows, dates, travel, media, and notes.
- `Gig`: a specific tour date or venue package, including location, schedule, notes, media, and status.
- `Trip`: a mobile-captured travel session that can sync into the web system as a draft operational log.

The current implementation keeps some inherited internal names where they preserve working code paths, but the user-facing product direction is tours and gigs.

## Monorepo Layout

```text
apps/
  web/        Next.js app, Prisma schema, API routes, dashboard, public site
  mobile/     Expo React Native app for mobile capture and sync
packages/
  shared/     shared TypeScript domain types, schemas, DTOs, utilities
scripts/
  sync-env-to-mobile.mjs
```

## Tech Stack

- npm workspaces
- TypeScript
- Next.js 16
- React 19
- Prisma 7
- PostgreSQL
- Supabase Auth and Storage
- Tailwind CSS
- Vitest
- Expo React Native
- AsyncStorage

## What Works Now

Web app:

- Public home, tour, story, map, gallery, posts, profile, and shared workspace routes.
- Authenticated dashboard structure.
- Tour and gig CRUD flows.
- Activity notes, media links, posts, visibility controls, sharing, and settings.
- Driving/trip log workflows inherited from the reference architecture.
- Prisma schema and generated client.
- API routes for media upload, quick-entry sync, mobile tour/gig data, and completed trip sync.

Mobile app:

- Supabase sign-in.
- Local trip tracking state.
- Recent trip history and retryable completed-trip sync.
- Android location tracking structure.
- Tour selection and management screens.
- Vehicle setup and diagnostics screens.

## Quick Start

Install dependencies:

```bash
npm ci
```

Generate Prisma client:

```bash
npm run db:generate
```

Run type checks:

```bash
npm run typecheck
```

Run the web app:

```bash
npm run dev:web
```

Run the mobile app:

```bash
npm run dev:mobile
```

## Environment

Copy the examples before running connected auth/database flows:

```text
apps/web/.env.example -> apps/web/.env
apps/mobile/.env.example -> apps/mobile/.env
```

Useful root scripts:

- `npm run dev:web`
- `npm run dev:mobile`
- `npm run build:web`
- `npm run typecheck`
- `npm run test:run`
- `npm run env:sync:mobile`

## Demo Notes

This repo favors easy portfolio review:

- The app can be inspected as a real web/mobile monorepo without needing a live production deployment.
- TypeScript checks pass across shared, web, and mobile packages.
- The README keeps future scope visible without pretending every production workflow is complete.

## Future Expansion

High-value next steps:

- Replace inherited trip/driving language with tour logistics language where it improves user experience.
- Add act/performer profiles with contacts, riders, crew, set times, and availability.
- Add venue records with contacts, parking/load-in notes, settlement details, and production constraints.
- Add day sheets and printable/shareable itineraries.
- Add guest list and pass management.
- Add expense tracking and settlement summaries.
- Add document storage for contracts, riders, invoices, and insurance.
- Add role-based team access for tour managers, production managers, artists, and accountants.
- Add offline-first gig notes and checklist capture in the mobile app.
- Add calendar exports and integrations.
- Add richer public tour pages for portfolio, fan, or promoter-facing content.

## Project Status

GigEze is a working demo scaffold, not a finished SaaS product. The goal is to show architecture, implementation judgment, and a credible path from inherited app foundation to a focused entertainment operations tool.

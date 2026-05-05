# GigEze

[![Status](https://img.shields.io/badge/status-working%20demo-blue)](#project-status)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict%20monorepo-3178c6)](#tech-stack)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](#tech-stack)
[![React](https://img.shields.io/badge/React-19-61dafb)](#tech-stack)
[![Mobile](https://img.shields.io/badge/mobile-Expo%20React%20Native-4630eb)](#tech-stack)

GigEze is a full-stack web and mobile application for tour and live entertainment operations. It brings together tour/gig coordination, field activity capture, media and public presentation, and mobile-to-web sync workflows.

The system uses a TypeScript-first monorepo architecture with a Next.js web platform, Expo React Native mobile app, Prisma/PostgreSQL persistence model, Supabase Auth/Storage integration points, and shared contracts for cross-app validation and DTOs.

Production URL: `https://gigeze.online`

## Contents

- [Product Overview](#product-overview)
- [Screenshots](#screenshots)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Key Technical Characteristics](#key-technical-characteristics)
- [Product Concept](#product-concept)
- [Architecture Diagrams](#architecture-diagrams)
- [Reviewer Guide](#reviewer-guide)
- [Documentation](#documentation)
- [Monorepo Layout](#monorepo-layout)
- [Tech Stack](#tech-stack)
- [What Works Now](#what-works-now)
- [Quick Start](#quick-start)
- [Environment](#environment)
- [Future Expansion](#future-expansion)
- [Project Status](#project-status)

## Product Overview

GigEze models the operational layer around live entertainment work: planning tours, managing gigs, capturing field movement, publishing selected public content, and keeping web/mobile workflows aligned.

Core workflows include:

- Tour and gig coordination for dates, venues, status, visibility, notes, and operational context.
- Mobile field activity capture for trip sessions, route samples, vehicle context, and completion handoff.
- Authenticated web dashboards for managing tours, gigs, media, activity notes, vehicles, settings, and synced trip logs.
- Public-facing routes for selected tours, stories, maps, gallery content, posts, and shared workspace/profile pages.
- Sync paths that let mobile-captured activity move into the web system as reviewable operational records.

## Screenshots

These screenshots show the current backstage/live-gig product direction across public surfaces, authenticated operations, and mobile field capture. A fuller screenshot index is available in [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md).

### Public Homepage

![GigEze public homepage](docs/screenshots/public-homepage.png)

Public product positioning and concert-poster inspired visual identity.

### Public Tours

![GigEze public tours listing](docs/screenshots/public-tours.png)

Published tour records presented through public routes.

### Public Map

![GigEze public tour map](docs/screenshots/public-map.png)

Published gigs plotted across Australia with route and venue context.

### Public Stories

![GigEze public stories listing](docs/screenshots/public-stories.png)

Story surface for tour updates and highlights sourced from backstage records.

### Dashboard Command Centre

![GigEze dashboard command centre](docs/screenshots/dashboard-command-centre.png)

Authenticated command-centre layout with quick actions and current tour context.

### Tours Board

![GigEze tours board](docs/screenshots/tours-board.png)

Tour and gig workflow surface backed by the Prisma domain model.

### Trip Sync

![GigEze trip sync log](docs/screenshots/trip-sync.png)

Field movement records with route history, filters, CSV export, and map previews.

### Vehicles

![GigEze vehicle management](docs/screenshots/vehicles.png)

Vehicle setup for tour operations, including defaults, odometer metadata, and editable records.

### Workspace Settings

![GigEze workspace settings](docs/screenshots/workspace-settings.png)

Workspace configuration for identity, default visibility, uploaded moment visibility, and GPS sampling cadence.

### Mobile Home

![GigEze mobile home](docs/screenshots/mobile-home.png)

Expo mobile field-capture home with live status, GPS quality, trip setup, and signed-in operator context.

### Mobile Trips

![GigEze mobile trips list](docs/screenshots/mobile-trips.png)

Mobile trip history with filters, vehicle context, trip modes, and grouped monthly summaries.

### Mobile Trip Detail

![GigEze mobile trip detail](docs/screenshots/mobile-trip-detail.png)

Completed-trip detail with route map, distance, start/finish metadata, and sync status.

### Mobile Settings

![GigEze mobile settings](docs/screenshots/mobile-settings.png)

Mobile operational preferences for screen wake behavior, vehicle/tour setup, and troubleshooting.

## Architecture at a Glance

- Web platform: Next.js 16 App Router for public publishing surfaces, authenticated dashboard workflows, server components, and API routes.
- Mobile field application: Expo React Native app for sign-in, tour selection, vehicle setup, trip capture, trip history, diagnostics, and retryable sync.
- Shared contracts: TypeScript package for schemas, domain types, DTOs, date helpers, distance utilities, and trip/session contracts.
- Sync architecture: local mobile trip state moves through completion, retry, and server ingestion into web-managed operational logs.
- Persistence layer: Prisma 7 schema and migrations targeting PostgreSQL for workspace-scoped tours, gigs, notes, media, vehicles, logs, and GPS samples.
- Auth/storage boundaries: Supabase Auth and Storage integration points isolate sign-in, bearer-token validation, and media upload concerns.

## Key Technical Characteristics

- Shared TypeScript contracts keep mobile payloads, web route handlers, and domain utilities aligned across package boundaries.
- Local-first trip capture protects mobile workflows from network availability, then syncs completed activity through explicit state transitions.
- Prisma acts as the source of truth for a relationship-heavy operational model spanning workspaces, users, tours, gigs, notes, media, posts, vehicles, driving logs, and GPS samples.
- Feature-oriented modules separate domain workflows from framework plumbing in both the Next.js app and Expo app.
- Next.js App Router supports public routes, authenticated dashboard surfaces, API boundaries, server-side data access, and deployment-oriented web structure.
- Expo React Native provides the mobile field workflow: sign-in, trip state, AsyncStorage persistence, route sample handling, and diagnostics.
- Validation and build discipline are first-class through `npm run typecheck`, `npm run test:run`, and `npm run build:web`.
- API routes define the integration boundary for mobile tour/gig data, media upload, quick-entry sync, and completed-trip ingestion.

## Product Concept

GigEze is organized around a tour-centric operating model for backstage and live-gig work. A tour is the parent operational container; gigs are the scheduled venue/date records; media, stories, notes, vehicles, and trip logs attach to that operating context.

Core concepts:

- `Tour`: the parent plan for a run of shows, dates, logistics, media, visibility, and notes.
- `Gig`: a specific tour date or venue package, including location, schedule, notes, media, and status.
- `Trip`: a mobile-captured movement or field activity session that can sync into the web system as a draft operational log.
- `Public surfaces`: selected tours, maps, stories, gallery content, posts, and profiles published from backstage records.

## Architecture Diagrams

Detailed Mermaid diagrams live in:

- [Architecture overview](docs/architecture-overview.md)
- [Data model](docs/data-model.md)
- [Mobile sync](docs/mobile-sync.md)

### Review Path Diagram

```mermaid
flowchart LR
  A["README"] --> B["Live demo: gigeze.online"]
  A --> C["apps/web/src/app"]
  A --> D["apps/mobile/src/screens"]
  A --> E["packages/shared/src"]
  A --> F["apps/web/prisma/schema.prisma"]

  C --> G["Public pages, dashboard, API routes"]
  D --> H["Mobile capture, history, diagnostics"]
  E --> I["Shared contracts, schemas, DTOs"]
  F --> J["Relational model: Workspace, Tour, Gig, Activity"]
```

## Reviewer Guide

For a quick technical pass, start here:

- `apps/web/src/app` - Next.js routes for public pages, authenticated app surfaces, and API endpoints.
- `apps/web/src/features/tours` and `apps/web/src/features/gigs` - core tour and gig workflows.
- `apps/web/src/features/activity-notes`, `apps/web/src/features/media`, and `apps/web/src/features/trips` - supporting operational features.
- `apps/web/prisma/schema.prisma` - relational model for workspaces, tours, gigs, media, posts, notes, vehicles, and trip activity.
- `apps/mobile/src/screens` - mobile flows for sign-in, tours, trip capture, history, vehicles, and diagnostics.
- `apps/mobile/src/features/trips` - local field activity capture and retryable completed-trip sync.
- `packages/shared/src` - shared schemas, types, utilities, and trip contracts used across the monorepo.
- `scripts/sync-env-to-mobile.mjs` - environment synchronization helper for web/mobile development.

Useful validation commands:

```bash
npm run typecheck
npm run test:run
npm run build:web
```

## Documentation

- [Architecture overview](docs/architecture-overview.md) - monorepo structure, layers, and integration points.
- [Data model](docs/data-model.md) - Prisma-backed domain model for workspaces, tours, gigs, media, activity notes, vehicles, and trip activity.
- [Mobile sync](docs/mobile-sync.md) - local mobile trip state, completed-trip sync, retry behavior, and persistence.
- [API overview](docs/api.md) - important route handlers and request/response notes.
- [Architecture decisions](docs/decisions.md) - concise tradeoffs behind the repo structure and stack.
- [Reviewer walkthrough](docs/walkthrough.md) - flagship mobile trip capture to web dashboard path.
- [Demo data](docs/demo-data.md) - seeded records and dataset notes.
- [Screenshots](docs/SCREENSHOTS.md) - visual index for public, dashboard, and mobile surfaces.

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
- Trip and field activity log workflows.
- Prisma schema and generated client.
- API routes for media upload, quick-entry sync, mobile tour/gig data, and completed-trip sync.

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

Generate the Prisma client:

```bash
npm run db:generate
```

Start the local development database:

```bash
npm run db:dev:start:win
```

Set `apps/web/.env` to the local Prisma database:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:51214/template1?sslmode=disable
```

Sync the schema and seed local demo data:

```bash
npm run db:push
npm run db:seed
```

Optionally seed the Neon Vultures demo dataset:

```bash
npm run db:seed:gigeze-demo
```

To intentionally target `apps/web/.env.production.local`, run:

```bash
npm run db:seed:gigeze-demo:prod
```

Only run demo seeds against a database where demo data is acceptable. The seed scripts target whichever PostgreSQL/Supabase database is configured by `DATABASE_URL` or the selected env file; see [demo data](docs/demo-data.md) for details.

Local development login:

```text
Email: admin@gigeze.app
Password: dev-admin-password
```

The Vercel-hosted deployment uses Supabase Auth accounts.

Run checks:

```bash
npm run typecheck
npm run test:run
```

Run the apps:

```bash
npm run dev:web
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

## Future Expansion

High-value next steps:

- Refine trip and field activity language into tour logistics language where it improves user experience.
- Add act/performer profiles with contacts, riders, crew, set times, and availability.
- Add venue records with contacts, parking/load-in notes, settlement details, and production constraints.
- Add day sheets and printable/shareable itineraries.
- Add guest list and pass management.
- Add expense tracking and settlement summaries.
- Add document storage for contracts, riders, invoices, and insurance.
- Add role-based team access for tour managers, production managers, artists, and accountants.
- Add offline-first gig notes and checklist capture in the mobile app.
- Add calendar exports and integrations.
- Add richer public tour pages for artist, fan, or promoter-facing content.

## Project Status

GigEze is a working demo scaffold, not a finished SaaS product. The repository keeps the implementation, docs, screenshots, and validation path public so the product and architecture are easy to understand.

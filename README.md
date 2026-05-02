# GigEze

[![Status](https://img.shields.io/badge/status-working%20demo-blue)](#project-status)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict%20monorepo-3178c6)](#tech-stack)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](#tech-stack)
[![React](https://img.shields.io/badge/React-19-61dafb)](#tech-stack)
[![Mobile](https://img.shields.io/badge/mobile-Expo%20React%20Native-4630eb)](#tech-stack)

GigEze is a public portfolio monorepo for entertainment and tour operations, built to show senior full-stack product engineering across modern web, mobile, data, and shared TypeScript boundaries.

The project pairs a Next.js 16 web application with an Expo React Native mobile app, Prisma/PostgreSQL data modeling, Supabase Auth/Storage integration points, and a shared TypeScript package. It is intentionally scoped as a working demo scaffold rather than a finished SaaS product, with enough architecture and workflow depth for technical review.

Public web deployment: `https://gigeze.online`

## Contents

- [What This Demonstrates](#what-this-demonstrates)
- [Reviewer Guide](#reviewer-guide)
- [Screenshots](#screenshots)
- [Architecture Diagrams](#architecture-diagrams)
- [Why This Exists](#why-this-exists)
- [Product Concept](#product-concept)
- [Monorepo Layout](#monorepo-layout)
- [Tech Stack](#tech-stack)
- [What Works Now](#what-works-now)
- [Quick Start](#quick-start)
- [Environment](#environment)
- [Demo Notes](#demo-notes)
- [Future Expansion](#future-expansion)
- [Project Status](#project-status)

## What This Demonstrates

- Full-stack application architecture across web, mobile, database, and shared package layers.
- Modern TypeScript delivery with Next.js App Router, React 19, Expo React Native, Prisma, and Vitest.
- Domain modeling for authenticated workspace workflows: tours, gigs, media, activity notes, and trip sync.
- API and integration thinking for auth, storage, mobile sync, and server-side data access.
- Product judgment: clear scope, operational workflows, public-facing pages, and a credible growth path.
- Enterprise engineering habits that complement Microsoft, Dynamics, and Azure experience: structured data, workflow boundaries, maintainable modules, and deployment-aware design.

## Reviewer Guide

For a quick technical review, start here:

- `apps/web/src/app` - Next.js routes for public pages, authenticated app surfaces, and API endpoints.
- `apps/web/src/features/tours` and `apps/web/src/features/gigs` - core tour and gig workflows.
- `apps/web/src/features/activity-notes`, `apps/web/src/features/media`, and `apps/web/src/features/trips` - supporting operational features.
- `apps/web/prisma/schema.prisma` - relational data model for workspaces, tours, gigs, media, posts, notes, vehicles, and trip activity.
- `apps/mobile/src/screens` - mobile user flows for sign-in, tours, trip capture, history, vehicles, and diagnostics.
- `apps/mobile/src/features/trips` - local field activity capture and retryable completed-trip sync.
- `packages/shared/src` - shared schemas, types, utilities, and trip contracts used across the monorepo.
- `scripts/sync-env-to-mobile.mjs` - environment synchronization helper for web/mobile development.

Useful validation commands:

```bash
npm run typecheck
npm run test:run
npm run build:web
```

## Screenshots

Screenshots will be added as the public Vercel deployment is finalized.

Planned coverage:

- Public tour page
- Authenticated dashboard
- Tour and gig management
- Mobile trip/field activity capture
- Completed-trip sync flow

## Architecture Diagrams

Architecture diagrams will be added as lightweight review assets.

Planned diagrams:

- Monorepo package structure
- Web, mobile, shared package, and database interaction flow
- Mobile field activity capture and completed-trip sync flow
- Auth and storage integration boundaries

## Why This Exists

This repository is intended as a public portfolio project and a focused example of building a full-stack application from scratch. It demonstrates:

- Full-stack monorepo architecture with shared TypeScript contracts.
- Next.js dashboard and public web surfaces.
- Prisma data modeling for authenticated workspace workflows.
- Supabase Auth and Storage integration points.
- Expo React Native mobile app structure.
- Local-first mobile trip capture with completed-trip sync.
- Practical product thinking for a niche operations tool.

## Product Concept

GigEze helps a tour manager coordinate the operational record around live entertainment work.

Core concepts:

- `Tour`: the parent plan for a run of shows, dates, logistics, media, and notes.
- `Gig`: a specific tour date or venue package, including location, schedule, notes, media, and status.
- `Trip`: a mobile-captured movement or field activity session that can sync into the web system as a draft operational log.

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
- The public web deployment is planned for Vercel at `https://gigeze.online`.
- TypeScript checks pass across shared, web, and mobile packages.
- The README keeps future scope visible without pretending every production workflow is complete.

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
- Add richer public tour pages for portfolio, fan, or promoter-facing content.

## Project Status

GigEze is a working demo scaffold, not a finished SaaS product. The goal is to show architecture, implementation judgment, and a credible path from original product concept to focused entertainment operations tool.

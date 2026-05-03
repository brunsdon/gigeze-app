# Decisions

## Monorepo

The repo keeps web, mobile, shared contracts, Prisma schema, and scripts together so a reviewer can trace full-stack behavior without jumping across projects.

## Shared TypeScript Package

`packages/shared` prevents duplicated trip/session contracts and utilities between Next.js and Expo. It gives the demo a clear boundary for cross-platform domain logic.

## Prisma/PostgreSQL

The domain is relational: workspaces own tours, gigs, notes, media, vehicles, and trip logs. Prisma gives typed access to those relationships, and PostgreSQL leaves room for reporting, filtering, transactions, and future operational queries.

## Supabase Integration Points

Supabase is used for auth/session validation and storage integration without building custom identity or object-storage plumbing for a portfolio scaffold.

## Expo React Native

Expo keeps the mobile demo focused on product workflow and device capabilities: sign-in, local trip capture, GPS/background tracking structure, diagnostics, and sync.

## Local-First Trip Capture

Trips are captured locally first because field activity can happen with weak connectivity. Completed trips move into a retryable sync state and are reconciled with the web backend when auth and network are available.

## Feature Folders

Feature folders make the code review path easier: tours, gigs, trips, media, activity notes, vehicles, and quick-entry behavior can be inspected as domain workflows instead of scattered framework files.

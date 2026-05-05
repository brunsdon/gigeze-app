# Local Development

This guide covers the setup details that sit behind the short README quick start.

## Prerequisites

- Node.js 20 or newer
- npm
- A local PostgreSQL development database started through the project script

## Install

```bash
npm ci
```

Generate the Prisma client:

```bash
npm run db:generate
```

## Local Database

Start the local development database:

```bash
npm run db:dev:start:win
```

Set `apps/web/.env` to the local Prisma database:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:51214/template1?sslmode=disable
```

Push the schema and seed local data:

```bash
npm run db:push
npm run db:seed
```

Local development login:

```text
Email: admin@gigeze.app
Password: dev-admin-password
```

The Vercel-hosted deployment uses Supabase Auth accounts.

## Optional Demo Dataset

Seed the Neon Vultures demo dataset:

```bash
npm run db:seed:gigeze-demo
```

To intentionally target `apps/web/.env.production.local`, run:

```bash
npm run db:seed:gigeze-demo:prod
```

Only run demo seeds against a database where demo data is acceptable. The seed scripts target whichever PostgreSQL/Supabase database is configured by `DATABASE_URL` or the selected env file. See [demo data](demo-data.md) for the dataset contents and intentional omissions.

## Environment Files

Copy the examples before running connected auth/database flows:

```text
apps/web/.env.example -> apps/web/.env
apps/mobile/.env.example -> apps/mobile/.env
```

Use the env sync helper when the mobile app needs safe public values from the web environment:

```bash
npm run env:sync:mobile
```

## Running Apps

```bash
npm run dev:web
npm run dev:mobile
```

Useful mobile scripts:

```bash
npm run dev:mobile:usb
npm run mobile:android
npm run mobile:android:usb
```

## Validation

```bash
npm run typecheck
npm run test:run
npm run build:web
```

## Useful Root Scripts

- `npm run dev:web`
- `npm run dev:mobile`
- `npm run build:web`
- `npm run typecheck`
- `npm run test:run`
- `npm run env:sync:mobile`
- `npm run db:generate`
- `npm run db:push`
- `npm run db:seed`

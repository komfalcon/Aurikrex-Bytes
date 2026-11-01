# Aurikrex Bytes

> **A calmer way to keep up. Aurikrex Bytes — what matters.**
>
> A product of Aurikrex, founded by Korede Omotosho.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-11.x-2596be.svg)](https://trpc.io/)
[![Turso](https://img.shields.io/badge/Database-Turso%20LibSQL-00eb88.svg)](https://turso.tech/)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel-black.svg)](https://www.bytes.aurikrex.com)

## What it is

**Aurikrex Bytes** is a daily technology briefing for people who want the important developments in technology without the noise of an infinite feed. Each drop is a finite editorial experience: stories are gathered from trusted sources, deduplicated, summarized with context, and presented in a focused reader interface.

The product is built around a simple promise: **less noise, more signal**. Readers can browse the latest drop, search the archive, save and react to posts, track reading streaks, install the progressive web app, subscribe to push notifications, and ask Falke AI follow-up questions with source context.

The production site is [www.bytes.aurikrex.com](https://www.bytes.aurikrex.com).

## Current product capabilities

### Reader experience

- Home page with the latest editorial drop, featured Byte preview, and sample carousel.
- Reader dashboard with daily completion state, reading streaks, feed preferences, and editorial or compact viewing modes.
- Archive search with technology and company filters, including Apple, Google, AI, Nvidia, Microsoft, Meta, Amazon, Startups, Security, and Cloud.
- Individual post pages with formatted editorial copy, reactions, bookmarks, related content, and Falke AI follow-ups.
- Saved posts, profile management, avatar uploads, name and nickname editing, email verification, password reset, and Google reader sign-in.
- Responsive light/dark themes, mobile navigation, PWA installation support, and an end-of-feed experience.
- Help, contact, privacy, terms, and maintenance-mode surfaces.

### Editorial newsroom

- Private newsroom login and role-based access for administrators and editors.
- Create, edit, preview, submit, approve, reject, publish, schedule, unschedule, and delete posts.
- Batch post actions for deletion, publishing, and scheduling.
- Team management, role changes, access revocation, analytics, maintenance controls, and notification operations.
- Multi-source curation from Hacker News Algolia and technology RSS feeds, with duplicate-story detection and source normalization.
- AI-assisted curation that can produce 20–30 draft candidates per run, enforce editorial length boundaries, sanitize headlines, and generate share-card artwork.
- Multi-story PDF/image ingestion with concurrent extraction capacity of up to 50 stories per document.

### Notifications and platform services

- OneSignal web push subscriptions with an opt-in prompt, service-worker delivery, send ledger, idempotent dispatch, retry/recovery controls, and pruning of invalid subscriptions.
- Scheduled daily notification windows at **08:00 and 22:00 Africa/Lagos time** through the Vercel cron configuration.
- Resend email delivery with SMTP fallback for verification, password reset, support, and operational messages.
- Turso LibSQL database access through Drizzle ORM.
- Cloudinary upload signatures for post imagery and reader avatars.
- SEO routes for `robots.txt`, `sitemap.xml`, crawler-friendly share pages, Open Graph metadata, Twitter cards, canonical URLs, and JSON-LD.
- Security headers, rate limiting, password lockout protection, session token versioning, and password-change session revocation.

## Architecture

```text
Sources and PDFs
      |
      v
AI curation + deduplication + editorial constraints
      |
      v
Draft newsroom -> review / approval -> scheduled daily drop
      |
      v
Reader web app -> archive / streaks / saves / push / Falke AI follow-up
```

The application is a TypeScript monorepo-style full-stack app with a React/Vite client, an Express server for local development, tRPC procedures for the application API, and a Vercel serverless entry point for production.

### Main directories and files

- `client/src/App.tsx` — client router, theme provider, error boundary, maintenance handling, and PWA prompt.
- `client/src/public/ReaderPages.tsx` — public home, dashboard, archive, post, profile, authentication, help, contact, privacy, and terms surfaces.
- `client/src/admin/` — newsroom, post creation, previews, team management, analytics, and notification dashboards.
- `client/src/components/` — shared UI, formatted editorial content, push prompts, SEO, theme, and layout components.
- `server/routers.ts` — tRPC procedures for authentication, reader activity, public posts, newsroom workflows, analytics, push notifications, and Falke AI follow-ups.
- `server/_core/aiCurator.ts` — source ingestion, deduplication, multi-key AI fallback, editorial constraints, and card generation.
- `server/_core/pdfParser.ts` — multi-story PDF and image extraction pipeline.
- `server/_core/security.ts` — security headers, rate limiting, lockout handling, and authentication safeguards.
- `server/_core/seoRoutes.ts` — crawler routes, sitemap, robots, and share metadata responses.
- `server/_core/vercel.ts` — production Vercel serverless entry point.
- `server/push.ts`, `server/pushConfig.ts`, and `server/pushLedger.ts` — OneSignal delivery, scheduling, idempotency, and recovery logic.
- `drizzle/schema.ts` — SQLite schema for users, posts, readers, views, reactions, bookmarks, searches, push subscriptions, system settings, and push sends.
- `vercel.json` — Vercel builds, rewrites, redirects, headers, and cron schedules.
- `.env.example` — runtime, database, authentication, email, storage, AI, notification, and central-platform configuration.

## Routes

### Public and reader routes

- `/` — latest briefing and product landing page
- `/dashboard` — reader desk and streaks
- `/archive` — searchable archive
- `/post/:id` — individual Byte
- `/saved` — bookmarked posts
- `/profile` — reader profile and preferences
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` — reader authentication flows
- `/how-it-works`, `/help`, `/contact`, `/privacy`, `/terms` — support and policy pages
- `/sso/login`, `/sso/callback` — central SSO flow

### Private newsroom routes

- `/falcon-system-auth` — newsroom login
- `/admin` — newsroom dashboard
- `/admin/new` and `/admin/new/:id` — create or edit a post
- `/admin/preview/:draftId` — draft preview
- `/admin/team` — team and role management
- `/admin/analytics` — newsroom analytics
- `/admin/notifications` — push notification operations

## Local development

Requirements: Node.js, pnpm, and a configured local environment file.

```bash
# Install dependencies
pnpm install

# Create local configuration
cp .env.example .env

# Start the Express + Vite development server
pnpm dev

# Type-check the project
pnpm check

# Run the Vitest suite
pnpm test

# Apply database schema changes
pnpm db:push

# Build the client and server bundles
pnpm build

# Start the production server bundle locally
pnpm start
```

The test suite is configured under `server/**/*.test.ts` and currently covers curation, PDF extraction, authentication, permissions, sessions, cron behavior, push delivery, SEO, schema behavior, and reader streaks.

## Configuration

Copy `.env.example` to `.env` and provide the values required by the environment. The main configuration groups are:

- Runtime: `NODE_ENV`, `PORT`, `APP_BASE_URL`, `APP_TIMEZONE`
- Database: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, or the configured database URL
- Auth and jobs: `JWT_SECRET`, `CRON_SECRET`, OAuth and SSO values
- Notifications: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
- Email: Resend credentials, with SMTP fallback
- Media: Cloudinary credentials
- AI: Gemini primary and fallback keys, plus optional NVIDIA, Mistral, and Cloudflare AI fallbacks
- Central platform: `CENTRAL_API_URL` and the Aurikrex Central service-to-service secret

Never commit real secrets. Use the deployment platform's environment-variable settings for production values.

## Deployment

Vercel runs the static client build and the bundled serverless API from `api/index.js`. The production build is generated by:

```bash
pnpm build
```

`vercel.json` also configures security and cache headers, crawler-aware rewrites, canonical-domain redirects, API routing, and two cron invocations of `/api/cron/notify` each day. Pushing to `main` triggers the connected Vercel deployment when the repository is linked to the Vercel project.

## Design direction

Aurikrex Bytes uses a calm editorial visual system: Newsreader-style serif headlines, Inter-style interface text, blue interaction accents, generous whitespace, responsive cards, and coordinated light/dark surfaces. The interface is designed to make a daily briefing feel finite, readable, and worth returning to.

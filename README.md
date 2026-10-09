# Aurikrex Bytes

> **A calmer way to keep up. Aurikrex Bytes — what matters.**
> *A product of Aurikrex, founded by Korede Omotosho.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-11.x-2596be.svg)](https://trpc.io/)
[![Turso](https://img.shields.io/badge/Database-Turso%20LibSQL-00eb88.svg)](https://turso.tech/)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel%20Serverless-black.svg)](https://www.bytes.aurikrex.com)

---

## 🎯 Purpose & What the Product Leads With

**Aurikrex Bytes** is a daily curated technology briefing engineered for people who want the essential developments in tech without the noise of infinite social media feeds.

- **The Daily Drop Ritual**: Five to ten considered technology stories, edited and contextualized, delivered every morning at **8:00 AM**. Staying informed has a clear beginning and an end.
- **The Native Shape**: A structured editorial publication pipeline — from multi-source AI candidate ingestion (Hacker News Algolia, Ars Technica, The Verge, TechCrunch, and multi-story PDF OCR) through human editorial fine-tuning, to a clean daily drop, interactive reader desk with streak tracking, and conversational **Falke AI** follow-ups.
- **Tagline**: *"Make room for what matters. Less noise. More signal."*

---

## 🏛️ Architecture & Native Data Shape

The codebase is organized around the lifecycle of a **Byte** and the reader ritual:

```
[Ingestion Engine] ──> [Editorial Newsroom] ──> [Daily Drop (08:00)] ──> [Reader Desk & Follow-Up]
• HN Algolia (pts ≥ 20)  • Draft inbox (Drizzle)   • /api/cron/publish       • Streak tracking (Flame)
• Tech RSS feeds        • 600-800 char briefs     • OneSignal push digests  • Editorial / Compact views
• Multi-story PDF OCR   • Cloudinary / SVG cards  • Vercel Edge caching     • Falke AI conversational Q&A
```

---

## 📁 Critical Files & Directory Guide

### 1. Server Core & APIs (`/server`)
- [`server/_core/vercel.ts`](server/_core/vercel.ts): Production entry point for Vercel Serverless Functions (`api/index.js`), handling route matching, cron secret authentication, security headers, and reverse proxies.
- [`server/_core/index.ts`](server/_core/index.ts): Express server runtime for local development and self-hosted environments.
- [`server/routers.ts`](server/routers.ts): Comprehensive tRPC API router implementing:
  - `publicPosts`: Homepage drops, archive search, carousel queries, and live `askFollowUp` Falke AI web search.
  - `reader`: Sessions, login, signup, avatar uploads, email verification, password reset, bookmarks, fire reactions, and streak tracking.
  - `admin`: Secure newsroom access, post publishing, draft editing, and analytics.
- [`server/_core/aiCurator.ts`](server/_core/aiCurator.ts): Automated ingestion pipeline with multi-key Gemini cascade, headline sanitization (`cleanHeadline`), editorial brief boundaries (600–800 chars), and dynamic SVG card generation.
- [`server/_core/pdfParser.ts`](server/_core/pdfParser.ts): Multi-story PDF and image OCR parser powered by Falke AI, extracting up to 20+ stories from document uploads concurrently.
- [`server/_core/security.ts`](server/_core/security.ts): Security headers (CSP, HSTS, X-Frame-Options), global rate limiting (30 requests/min per IP), 5-attempt password lockout (15 minutes), and 8-attempt automatic password reset link dispatch.
- [`server/_core/seoRoutes.ts`](server/_core/seoRoutes.ts): Dynamic XML sitemap generator (`/sitemap.xml`), crawler routing, `robots.txt`, and OpenGraph social share card generation.
- [`server/services.ts`](server/services.ts): Email dispatch service powered by **Resend API** with automatic SMTP fallback, and Cloudinary upload signature generation.
- [`server/push.ts`](server/push.ts): OneSignal push notification dispatch engine and automated pruning of invalid subscriptions.
- [`server/db.ts`](server/db.ts): Drizzle ORM database client connecting to Turso LibSQL (`@libsql/client`).
- [`drizzle/schema.ts`](drizzle/schema.ts): Database schemas defining `posts`, `readers`, `adminUsers`, `pushSubscriptions`, `oneSignalSubscriptions`, `searchQueries`, and `readerStreaks`.

### 2. Client & Presentation (`/client`)
- [`client/src/App.tsx`](client/src/App.tsx): Client-side Wouter router, ThemeProvider, ErrorBoundary, global `ScrollToTop`, and PWA install prompt.
- [`client/src/public/ReaderPages.tsx`](client/src/public/ReaderPages.tsx): Public surfaces:
  - `Home`: Editorial landing page with hero Byte preview, 3-step value proposition, and interactive sample carousel.
  - `ReaderDashboard`: Personalized reader desk with 7-day streak calendar, completion cards, and view mode switcher.
  - `PostDetail`: Clean typography view with `FollowUpPanel` featuring Claude-style collapsible source timeline.
  - `Archive`: Full-text search and brand filter chips (`Apple`, `Google`, `AI`, `Nvidia`, `Microsoft`, `Meta`, `Amazon`, `Startups`, `Security`, `Cloud`).
- [`client/src/components/ScrollToTopButton.tsx`](client/src/components/ScrollToTopButton.tsx): Floating, theme-aware back-to-top button.
- [`client/src/components/FormattedBody.tsx`](client/src/components/FormattedBody.tsx): High-contrast editorial typography formatter for stories and briefings.
- [`client/src/components/Seo.tsx`](client/src/components/Seo.tsx): Metadata manager injecting OpenGraph, Twitter card, canonical tags, and JSON-LD schemas.
- [`client/src/index.css`](client/src/index.css): Design system stylesheet defining CSS custom properties, light/dark themes, and responsive rules.

### 3. Infrastructure & Automation
- [`vercel.json`](vercel.json): Vercel configuration specifying `@vercel/node` and `@vercel/static-build`, 301 redirects to `https://www.bytes.aurikrex.com`, edge caching headers, and rewrites.
- [`.github/workflows/onesignal-daily.yml`](.github/workflows/onesignal-daily.yml): Automated GitHub Action dispatching push notifications at 08:00 AM WAT and 10:00 PM WAT.
- [`.env.example`](.env.example): Complete environment variable schema.

---

## 🎨 Visual Identity & Design System Tokens

Extracted directly from [`client/src/index.css`](client/src/index.css):

### Color Tokens
| Token | Light Value | Dark Value (`.dark`) | Usage |
|---|---|---|---|
| `--blue` | `#3b82f6` | `#3b82f6` | Brand accent, links, active states |
| `--blue-dark` | `#2563eb` | `#2563eb` | Hover states, primary buttons |
| `--bg` | `#f8fafc` | `#0b1220` | Page background |
| `--surface` | `#ffffff` | `#111c2e` | Card backgrounds, elevated surfaces |
| `--surface-2` | `#eff6ff` | `#172844` | Hover backgrounds, input fills |
| `--ink` | `#0f172a` | `#f8fafc` | Primary typography |
| `--muted` | `#64748b` | `#a8b7cc` | Secondary typography, captions, icons |
| `--line` | `#dbe4ef` | `#263b59` | Borders, dividers, subtle outlines |

### Typography
- **Headlines & Editorial Titles**: `var(--serif)` ➔ `"Newsreader", Georgia, serif`
- **Body & Interface**: `var(--sans)` ➔ `"Inter", system-ui, sans-serif`
- **Metadata, Pills & Queries**: `var(--font-mono)` ➔ `monospace, sans-serif`

### Spatial & Layout Rules
- **Container Max Width**: `1160px` (`var(--max)`)
- **Card Radius**: `14px` (`var(--radius)`)
- **Pill Radius**: `20px` to `9999px`
- **Elevation Shadows**:
  - Light: `0 12px 32px rgba(15, 23, 42, 0.07)`
  - Dark: `0 16px 36px rgba(0, 0, 0, 0.28)`

---

## 🚀 Key Goals

1. **Signal Over Noise**: Deliver a calm, finite briefing every morning (5–10 stories) that readers can complete in 5 minutes.
2. **Context Over Clickbait**: Every brief answers *what happened* and *why it matters* within an intentional 600–800 character boundary.
3. **Resilient Automated Workflow**: Ingest from trusted RSS and Hacker News sources, with multi-key AI fallbacks and strict character envelopes.
4. **Interactive Curiosity**: Empower readers to dive deeper via **Falke AI** follow-up questions backed by real-time web search and clear, collapsible source citations.
5. **Zero-Friction Reader Habit**: Support reading streaks, daily completion celebrations, and instantaneous PWA responsiveness.

---

## 🛠️ Development & Commands

```bash
# Install dependencies
pnpm install

# Run development server (Express + Vite)
pnpm dev

# Type check
pnpm check

# Run Vitest test suite (46 tests across 13 suites)
pnpm test

# Build for production
pnpm build
```

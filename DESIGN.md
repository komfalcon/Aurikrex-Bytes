# Aurikrex Bytes — Design System & Architecture Specification

> **"A calmer way to keep up. Aurikrex Bytes — what matters."**  
> *A product of Aurikrex, founded by Korede Omotosho.*  
> Canonical URL: [https://www.bytes.aurikrex.com](https://www.bytes.aurikrex.com)

---

## 1. Product Purpose & Brand Foundation

Aurikrex Bytes is designed as a daily tech briefing that rejects algorithmic doom-scrolling in favor of a calm, finite reading ritual.

### Core Value Proposition & Copy
* **The Lead Feature**: **The 8:00 AM Daily Drop**.
  > *"Five to ten considered technology stories, curated and edited for a better start to your day. A useful daily ritual, delivered at 8:00 AM."*
* **Brand Taglines**:
  * *"Make room for what matters. Less noise. More signal."*
  * *"One calm drop. The context behind what is changing. No endless scroll required."*
  * *"Made for the signal-seekers."*
* **The Three-Step Editorial Model**:
  1. **01 Daily Curation**: We scan the landscape for the stories that will shape conversations, products, and decisions.
  2. **02 8 AM Drop**: Our edited briefing arrives as a focused set of branded story cards.
  3. **03 Read Your Way**: Browse Today's Bytes or search the complete archive whenever you need it.

---

## 2. Native Product Shape & Lifecycle

Aurikrex Bytes is structured around a **Curated Daily Drop & Habit Loop Pipeline**:

```
[Ingestion & Multi-Source Extraction]
   │  • Hacker News Algolia API (points >= 20)
   │  • RSS Feeds (Ars Technica, The Verge, TechCrunch)
   │  • Multi-Story PDF Ingestion & OCR (Falke AI Vision Engine)
   ▼
[The Editorial Newsroom]
   │  • 600–800 Character brief envelope (clampEditorialBrief)
   │  • Noise sanitization (strips "Ask HN:", "[video]", "[pdf]", publisher suffixes)
   │  • Dynamic SVG editorial cards & Cloudinary CDN image optimization
   ▼
[The Scheduled Release Engine (08:00 AM WAT)]
   │  • /api/cron/publish triggers published status
   │  • Automated OneSignal push notification digests (morning 🌅 & evening 🌙)
   ▼
[The Reader Desk & Habit Loop]
   │  • Daily reading streaks (Flame icon + 7-day visual week calendar)
   │  • Reading view modes: "Editorial" (one Byte at a time) vs "Compact" (more signal per screen)
   │  • Completion cards upon finishing today's drop
   ▼
[Falke AI Conversational Follow-Up Workspace]
   │  • Full-screen interactive thread on /post/:id
   │  • Claude-style collapsible source timeline (⏱ Searched X web sources for "..." ›)
   │  • Tavily live web search + multi-model LLM synthesis
```

---

## 3. Design System & Visual Tokens

Extracted directly from [`client/src/index.css`](client/src/index.css):

### Color Tokens

| Token | Light Value | Dark Value (`.dark`) | Usage |
|---|---|---|---|
| `--blue` | `#3b82f6` | `#3b82f6` | Brand accent, active tabs, link highlights |
| `--blue-dark` | `#2563eb` | `#2563eb` | Button hover states, primary focus rings |
| `--bg` | `#f8fafc` | `#0b1220` | Root application background |
| `--surface` | `#ffffff` | `#111c2e` | Story cards, modaled sheets, floating controls |
| `--surface-2` | `#eff6ff` | `#172844` | Elevated pills, hover surfaces, inputs |
| `--ink` | `#0f172a` | `#f8fafc` | Primary editorial headings and body text |
| `--muted` | `#64748b` | `#a8b7cc` | Metadata, reading times, timestamps, icons |
| `--line` | `#dbe4ef` | `#263b59` | Subtle structural dividers and card borders |

### Typography & Fonts

* **Headlines & Story Titles**:  
  `font-family: var(--serif);` ➔ `"Newsreader", Georgia, serif`  
  *Style: High-contrast editorial authority, balanced line-height (`1.15`–`1.25`).*
* **Interface & Body Text**:  
  `font-family: var(--sans);` ➔ `"Inter", system-ui, sans-serif`  
  *Style: Legible, modern body copy (`15px`, line-height `1.6`).*
* **Search Pills, Tags & Queries**:  
  `font-family: var(--font-mono);` ➔ `monospace, sans-serif`  
  *Style: Clean technical precision for search tags and metadata.*

### Elevation, Radii & Layout Tokens

* **Container Max Width**: `1160px` (`var(--max)`)
* **Base Card Radius**: `14px` (`var(--radius)`)
* **Pill & Button Radius**: `20px` to `9999px`
* **Box Shadows**:
  * Light: `0 12px 32px rgba(15, 23, 42, 0.07)`
  * Dark: `0 16px 36px rgba(0, 0, 0, 0.28)`
* **Fire Reaction Gradient**:
  * Linear gradient: `#1d4ed8` ➔ `#7c3aed` ➔ `#f6c85f`
  * Active ember core: `#fff2be`

---

## 4. UI Patterns & Component Hierarchy

### A. The Story Card (`.post-card`)
* **Editorial Split**: High-resolution Cloudinary cover image (`f_auto,q_auto`) on the left/top, with editorial headline, timestamp (`formatDate`), estimated reading time (`4 min read`), and brief snippet.
* **Engagement Strip**: Fire reaction counter, bookmark toggle, and native social share trigger.

### B. The Reader Desk (`.reader-dashboard`)
* **Streak Card**: Displays active streak count with flame celebration animation and a 7-day calendar strip showing daily completion status.
* **View Mode Switcher**:
  * **Editorial Mode**: Full-sized cards for focused reading.
  * **Compact Mode**: Density-optimized scanning view.
* **Completion Card**: Appears when all daily stories have been read ("Nice! You've finished today's Bytes. 🎉").

### C. Falke AI Follow-Up Workspace (`.followup-fullscreen-view`)
* **Pinned Bottom Bar**: Minimal pill form (`.followup-bottom-pill-form`) pinned at viewport bottom.
* **Full-Screen Workspace**: Displays context kicker (`Follow up to [Headline]`), user question bubble, and Falke AI response.
* **Claude-Style Collapsible Search Bar**:
  * **Default State**: Compact single-line summary (`⏱ Searched 3 sources for "..." ›`).
  * **Expanded State**: Opens a clean timeline modal displaying search steps (`● Exploring context...`, `🌐 Searched for "..."`, `● Synthesizing response with Falke AI`) and query pills.

### D. Floating Navigation
* **Scroll to Top Button (`.scroll-to-top-btn`)**:
  * Fixed at `bottom: 24px, right: 24px` (repositioned on mobile to `bottom: 84px, right: 16px`).
  * Smooth entry animation when `window.scrollY > 300`.
  * Theme-aware variables (`var(--surface)`, `var(--ink)`, `var(--line)`).

---

## 5. Critical Files & Architecture Map

| Layer | Critical Files | Responsibility |
|---|---|---|
| **Serverless Entry** | [`server/_core/vercel.ts`](server/_core/vercel.ts) | Vercel production handler, cron authorization, reverse proxy, headers |
| **API Router** | [`server/routers.ts`](server/routers.ts) | tRPC endpoints (`publicPosts`, `reader`, `admin`, `system`) |
| **Ingestion Engine** | [`server/_core/aiCurator.ts`](server/_core/aiCurator.ts) | Multi-source RSS/HN ingestion, headline cleaner, brief envelope clamp |
| **Document Vision** | [`server/_core/pdfParser.ts`](server/_core/pdfParser.ts) | Multi-story PDF and image OCR parser powered by Falke AI |
| **Security & Limits** | [`server/_core/security.ts`](server/_core/security.ts) | 30 req/min IP rate limiting, 5-attempt lockout, 8-attempt auto-reset |
| **SEO & Crawlers** | [`server/_core/seoRoutes.ts`](server/_core/seoRoutes.ts) | Dynamic `/sitemap.xml`, `robots.txt`, dynamic OG share card images |
| **Email Service** | [`server/services.ts`](server/services.ts) | Resend API email delivery with automatic SMTP fallback |
| **Push Notifications** | [`server/push.ts`](server/push.ts) | OneSignal dynamic story notification payload construction |
| **Database & Schema** | [`server/db.ts`](server/db.ts), [`drizzle/schema.ts`](drizzle/schema.ts) | Turso LibSQL connection and relational tables |
| **Public Views** | [`client/src/public/ReaderPages.tsx`](client/src/public/ReaderPages.tsx) | Home, ReaderDashboard, PostDetail, FollowUpPanel, Archive, Saved |
| **Design Stylesheet** | [`client/src/index.css`](client/src/index.css) | Complete design system tokens, typography scales, light/dark themes |
| **Deployment Spec** | [`vercel.json`](vercel.json) | 301 host redirects, Edge CDN caching, static builds, and serverless rewrites |

---

## 6. Core Design Goals & Guardrails

1. **Finite, High-Signal Reads**: Never present infinite scroll feeds. Stories are bounded to a single daily drop.
2. **Context First**: Headlines must always be paired with the underlying context explaining *why it matters*.
3. **Typography Authority**: Editorial headlines use high-contrast serif typography (`Newsreader`), while interactive elements use modern sans-serif (`Inter`).
4. **Resilient AI Pipeline**: Automated ingestion features multi-key fallbacks to guarantee uninterrupted daily drops.
5. **No Invented Placeholders**: Every visual element, label, and copy block is grounded in the authentic product domain.

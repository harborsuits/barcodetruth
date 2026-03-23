

# Barcode Truth — Full System Audit

---

## 1. Product Concept

**Barcode Truth** is a consumer transparency platform that lets users scan product barcodes (or search by brand name) and see an ethics/accountability profile for the brand behind the product. It answers: *"Who profits from my purchase, and what's their track record on labor, environment, politics, and social issues?"*

The core value proposition has three pillars:
- **Power & Profit**: Who owns the brand, who runs it, who profits (institutional holders)
- **Personalized Scoring**: 4-axis ethics scores (labor, environment, politics, social) weighted by the user's own values
- **Evidence-based**: Every score is backed by traceable, sourced events — no opinions, no black boxes

---

## 2. Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                 │
│  React 18 + TypeScript + Tailwind + shadcn/ui           │
│  TanStack Query for data fetching/caching               │
│  Lazy-loaded routes via React.lazy + custom lazyNamed   │
│  PWA: Service Worker + manifest + offline indicator     │
│  Deployed: Railway (Express static server) + Lovable    │
├─────────────────────────────────────────────────────────┤
│                    BACKEND (Lovable Cloud / Supabase)    │
│  Auth: Supabase Auth (email/password)                   │
│  Database: PostgreSQL with RLS                          │
│  Edge Functions: 65+ Deno functions                     │
│  Storage: Not heavily used (logos are external URLs)     │
│  Realtime: Not currently active                         │
├─────────────────────────────────────────────────────────┤
│                    DATA PIPELINE                        │
│  Ingestion: RSS (Google News), EPA, OSHA, FDA, FEC,    │
│             SEC Edgar, Reddit RSS                       │
│  Enrichment: Wikidata (ownership, people, descriptions) │
│  Categorization: 140+ keyword classifier + domain hints │
│  Scoring: Hybrid √count + severity + recency decay      │
│  Identity: Self-healing verification via Wikidata       │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema (Core Tables)

The project has **391 migrations** and a massive schema. Key tables:

### Brand Data
| Table | Purpose |
|-------|---------|
| `brands` | Core brand records (name, slug, logo, website, description, wikidata_qid, status, identity_confidence, enrichment_stage) |
| `brand_aliases` | Alternative names mapping to canonical brands |
| `brand_slug_aliases` | Old slugs redirecting to current slugs |
| `brand_scores` | Per-brand category scores (labor, environment, politics, social) + overall |
| `brand_scores_history` | Score change log (trigger-populated) |
| `brand_events` | Evidence events linked to brands (title, category, orientation, impacts, verification, source_url, severity) |
| `brand_ownerships` | Parent-child brand relationships |
| `brand_api_usage` | Rate limiting per brand per day |

### Corporate Structure
| Table | Purpose |
|-------|---------|
| `companies` | Parent companies (name, ticker, exchange, country, is_public) |
| `company_ownership` | Brand → parent company links with confidence |
| `company_people` | CEO, founders, board members with images and Wikidata QIDs |
| `company_shareholders` | Institutional holders (from SEC 13F filings) |
| `company_valuation` | Market cap data |
| `asset_managers` | Known asset manager names (guard against parent company confusion) |

### Products
| Table | Purpose |
|-------|---------|
| `products` | UPC/EAN barcodes linked to brands |
| `product_claims` | User-submitted brand-product associations |

### User Data
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (email, onboarding status) |
| `user_roles` | Admin/moderator/user roles (separate table per security best practices) |
| `user_preferences` | Category value weights (labor/env/politics/social 0-100) |
| `user_scans` | Scan history per user |
| `user_billing` | Stripe subscription status |
| `user_push_subs` | Web push notification subscriptions |

### Evidence & Verification
| Table | Purpose |
|-------|---------|
| `event_sources` | Multiple sources per event (domain, credibility tier, canonical URL) |
| `source_credibility` | Per-domain credibility scores |
| `classification_audit` | Telemetry for categorization decisions |
| `dimension_research_checklist` | "Truth Assurance" — tracks which signal types have been checked per brand |

### Community
| Table | Purpose |
|-------|---------|
| `community_ratings` | User ratings per brand per category |
| `brand_category_outlook` | Materialized view of community sentiment |

### Infrastructure
| Table | Purpose |
|-------|---------|
| `rss_feeds` / `rss_items` | RSS feed management and ingested articles |
| `article_brand_matches` | Brand mentions detected in articles |
| `enrichment_runs` | Enrichment pipeline telemetry |
| `jobs` | Async job queue with coalescing |
| `health_check_results` / `data_quality_metrics` / `data_quality_log` | System health monitoring |
| `notification_log` | Push notification delivery log |
| `security_audit_log` | Sensitive access logging |

### Key Views
- `brand_data_coverage` (materialized) — coverage stats per brand
- `brand_standings` — ranked brand list
- `brand_trending` — trending brands
- `brand_monitoring_status` — ingestion freshness
- `v_brand_completeness` — data completeness audit
- `product_brand_profile` / `product_alternatives` — product-to-brand joins

### Key RPC Functions
- `brand_profile_view(brand_id)` — main profile data aggregation
- `get_brand_ownership(brand_id)` — ownership chain
- `get_power_profit(brand_id)` — combined leadership + shareholders + structure
- `get_key_people_for_brand(brand_id)` — CEO/founders
- `get_brand_feed_with_subsidiaries(brand_id)` — events including subsidiaries
- `compute_brand_score(brand_id)` — scoring formula
- `get_brand_profile_state(brand_id)` — 3-state profile status (assessable/building/needs_review)
- `can_user_scan(user_id)` — scan limit check (5 free/month)
- `search_catalog(query)` — fuzzy search across products + brands
- `personalized_brand_score(brand_id, user_id)` — weighted score

---

## 4. Edge Functions (65+ Functions)

### Data Ingestion (12)
| Function | Source |
|----------|--------|
| `unified-news-orchestrator` | Google News RSS → brand_events |
| `fetch-google-news-rss` | Raw RSS fetch |
| `fetch-reddit-rss` | Reddit RSS |
| `fetch-epa-events` | EPA violation data |
| `fetch-osha-events` | OSHA workplace safety |
| `fetch-fec-events` | FEC political contributions |
| `fetch-sec-edgar` | SEC filings |
| `ingest-fda-recalls` / `check-fda-recalls` | FDA recall data |
| `bulk-ingest-epa/fda/fec/osha` | Batch ingestion |
| `pull-feeds` | RSS feed polling |

### Brand Enrichment (8)
| Function | Purpose |
|----------|---------|
| `enrich-brand-wiki` | Wikidata: description, ownership, people, ticker |
| `enrich-top-brands` | Batch enrichment for top brands |
| `process-brand-stubs` | Process newly created brand stubs |
| `resolve-brand-logo` | Logo resolution from multiple sources |
| `fetch-brand-summary` | Wikipedia summary fetch |
| `verify-brand-identity` | Wikidata candidate scoring for identity healing |
| `trigger-enrichment` | Manual enrichment trigger (admin) |
| `trigger-brand-ingestion` | Manual ingestion trigger (admin) |

### Categorization & Scoring (8)
| Function | Purpose |
|----------|---------|
| `categorize-event` | 140+ keyword classifier with domain hints |
| `batch-recategorize` | Bulk re-categorization of mixed/neutral events |
| `reclassify-events` | Legacy reclassification tool |
| `recompute-brand-scores` | Score recalculation per brand |
| `bulk-calculate-scores` | Batch scoring |
| `calculate-baselines` | Historical baseline computation |
| `backfill-event-impacts` | Retroactive impact assignment |
| `historical-baseline-scanner` | Long-term baseline analysis |

### Product & Search (5)
| Function | Purpose |
|----------|---------|
| `scan-product` | Barcode scan → product + brand lookup |
| `resolve-barcode` | UPC/EAN resolution |
| `get-product-by-barcode` | Direct barcode lookup |
| `smart-product-lookup` | Fuzzy product matching |
| `search-brands` | Brand search with trigram similarity |

### Community & User (5)
| Function | Purpose |
|----------|---------|
| `community-rate` | Submit category rating |
| `community-outlook` | Aggregate community sentiment |
| `submit-product-claim` | User claims product→brand link |
| `submit-unknown-product` | Report unknown barcode |
| `delete-user` | GDPR user deletion |

### Payments (5)
| Function | Purpose |
|----------|---------|
| `create-checkout` | Stripe checkout session |
| `stripe-webhook` | Stripe event handler |
| `customer-portal` | Stripe customer portal |
| `check-subscription` | Subscription status check |
| `create-deep-scan-payment` | One-time deep scan payment |

### Verification & Quality (5)
| Function | Purpose |
|----------|---------|
| `verify-event` | Manual event verification (admin) |
| `auto-corroborate-events` | Auto-promote events with 2+ independent sources |
| `resolve-evidence-links` | Archive.org URL preservation |
| `archive-url` | Wayback Machine submission |
| `auto-accept-claims` | Auto-approve high-confidence product claims |

### Other (6)
| Function | Purpose |
|----------|---------|
| `brand-match` | Article → brand matching |
| `publish-snapshots` | Offline snapshot generation |
| `admin-health` | System health check |
| `admin-brand-retry` | Retry failed enrichments |
| `sync-13f` | SEC 13F institutional holdings sync |
| `v1-brands` | Public API endpoint |

---

## 5. Frontend Architecture

### Tech Stack
- **React 18** with TypeScript
- **Vite** bundler
- **Tailwind CSS** with design tokens in `src/styles/tokens.css`
- **shadcn/ui** component library (40+ components)
- **TanStack Query** for server state
- **React Router v6** with lazy loading
- **ZXing** for barcode scanning
- **date-fns** for date formatting

### Route Map (45 pages)

**Public Routes:**
- `/` — Home (Discover tab + My Scans tab)
- `/search` — Brand/product search
- `/discover` — Discovery page
- `/brand/:id` — Brand profile (canonical, supports slug or UUID)
- `/brands/:id` — Redirect to `/brand/:id`
- `/proof/:brandId` — Full evidence page
- `/trending` — Trending brands
- `/auth` — Login/signup
- `/methodology` — How scoring works
- `/privacy`, `/terms`, `/responsible-use` — Legal pages
- `/investor/:id`, `/person/:id` — Entity profiles

**Protected Routes (require auth):**
- `/scan` — Barcode scanner
- `/scan-result/:barcode` — Scan result page
- `/unknown/:barcode` — Unknown product submission
- `/feed` — Personalized feed
- `/lists` — Saved lists
- `/settings` — Preferences, subscriptions, push notifications
- `/onboarding` — Value slider setup (first run)

**Admin Routes (require admin role):**
- `/admin` — Dashboard with event quality stats
- `/admin/review` — Brand review queue
- `/admin/claims` — Product claim moderation
- `/admin/health` — System health
- `/admin/evidence/new` — Manual evidence entry
- `/admin/triggers` — Manual pipeline triggers
- `/admin/ingestion` — Ingestion control
- `/admin/events` — Event management
- `/admin/news-test` — News pipeline testing
- `/admin/rss-monitor` — RSS feed monitoring
- `/admin/enrichment` — Enrichment monitoring
- `/admin/community-ratings` — Community rating moderation
- `/admin/batch-enrich` — Batch enrichment
- `/admin/fortune-500-enrich` — Fortune 500 targeting
- `/admin/seeding` — Product seeding
- `/admin/users` — User management
- `/admin/category-tester` — Category classification testing
- `/admin/test-scorer` — Score testing
- `/admin/ops-health` — Operational health
- `/admin/ingestion-health` — Ingestion pipeline health

### Brand Profile State Machine (3 states)
```text
┌─────────────┐     identity verified     ┌──────────────┐
│  Needs       │ ──────────────────────► │  Building     │
│  Review      │     + 3+ dimensions      │  (progress)   │
│  (mismatch)  │                          │               │
└─────────────┘                          └──────┬────────┘
                                                │ 3+ evidence
                                                │ domains
                                                ▼
                                         ┌──────────────┐
                                         │  Assessable   │
                                         │  (full score) │
                                         └──────────────┘
```

- **Assessable**: Shows personalized scores, "Why this score?" narrative, Power & Profit card, evidence feed
- **Building**: Shows progress bars, "What's still needed" blockers, dimension coverage audit
- **Needs Review**: Shows IdentityFixCard with auto-fix and manual candidate selection

### Key UI Components
- `PowerProfitCard` — Who owns, who decides, who profits
- `PersonalizedScoreDisplay` — Score ring with user-weighted calculation
- `ScoreNarrative` ("Why this score?") — Cited events with per-event impact coloring
- `BuildingProfile` — Progress view for incomplete brands
- `NeedsReviewProfile` — Identity healing workflow
- `TrustPledge` — Transparency commitment card
- `ValueSliders` — User preference weights (labor/env/politics/social)
- `BrandLogo` — Logo with monogram fallback

---

## 6. Scoring System

### Formula
```text
Event Contribution = impact * severity * credibility * verification_factor * recency_decay
Category Score = 50 (baseline) + Σ(event contributions) * SCALE
Personal Score = Σ(user_weight[c] * category_score[c]) / Σ(user_weights)
Final = 50 + 50 * tanh(PersonalScore / k)
```

### Parameters
- **Recency decay**: Half-life 45 days
- **Verification factors**: official=1.4, corroborated=1.15, unverified=1.0
- **Impact range**: -5 to +5 per event per category
- **Score range**: 0-100 (50 = neutral baseline)
- **Severity spike guard**: Caps per-event impact at ±20 points

### Categorization
- 140+ keywords across 9 categories + noise detection
- Domain hints (FDA.gov → product_safety at 0.85 confidence)
- Finance noise filter (fool.com, seekingalpha.com → NOISE)
- Positive signal detection (job creation, FDA approval, community programs)
- Classification audit telemetry

---

## 7. Data Pipeline

```text
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Data Sources     │     │  Ingestion        │     │  Processing       │
│                  │     │                  │     │                  │
│  Google News RSS │────►│  unified-news-   │────►│  categorize-     │
│  EPA.gov         │     │  orchestrator    │     │  event           │
│  OSHA.gov        │     │                  │     │                  │
│  FDA.gov         │     │  brand-match     │     │  backfill-event- │
│  FEC.gov         │     │  (article→brand) │     │  impacts         │
│  SEC Edgar       │     │                  │     │                  │
│  Reddit RSS      │     │  pull-feeds      │     │  recompute-      │
│                  │     │  (RSS polling)   │     │  brand-scores    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                         │
                                                         ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Enrichment       │     │  Identity         │     │  Quality          │
│                  │     │                  │     │                  │
│  enrich-brand-   │     │  verify-brand-   │     │  auto-corroborate│
│  wiki (Wikidata) │     │  identity        │     │  -events         │
│                  │     │                  │     │                  │
│  resolve-brand-  │     │  Candidate       │     │  resolve-evidence│
│  logo            │     │  scoring:        │     │  -links          │
│                  │     │  domain +40      │     │                  │
│  sync-13f        │     │  ticker +35      │     │  dimension-      │
│  (SEC 13F)       │     │  name   +25      │     │  research-       │
│                  │     │                  │     │  checklist       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Truth Assurance System
The `dimension_research_checklist` tracks 16 signal types per brand:
- Status: "Found", "Attempted None" (verified absence), "Not Attempted"
- A dimension is "Verified" when: 1 Found event with official source OR 3 Attempted None including 1 primary source
- This distinguishes "no issues found" from "never checked"

---

## 8. Authentication & Authorization

- **Auth**: Supabase Auth with email/password (no auto-confirm)
- **Roles**: Stored in `user_roles` table (admin, moderator, user) — separate from profiles
- **RLS**: Enabled on most tables
- **Admin check**: `has_role(auth.uid(), 'admin')` security definer function
- **Route guards**: `ProtectedRoute` (auth required), `AdminRoute` (admin role required)
- **Scan limits**: 5 free scans/month for unauthenticated, unlimited for subscribers

---

## 9. Monetization

- **Free tier**: 5 barcode scans/month
- **Subscription**: Stripe integration with checkout, webhooks, customer portal
- **Deep scan**: One-time payment for detailed brand analysis
- **User billing**: Tracked in `user_billing` table

---

## 10. PWA Features

- Service Worker registration in `main.tsx`
- Web manifest at `public/manifest.webmanifest`
- Offline indicator component
- Service worker update prompt
- Snapshot prewarming for offline use (`useSnapshotPrewarm`)
- Push notification infrastructure (VAPID-based, currently disabled via feature flag)

---

## 11. Known Issues & Technical Debt

### Build Error (Active)
- `src/lib/pushNotifications.ts` has TypeScript errors: `pushManager` not on `ServiceWorkerRegistration` type. Needs a type declaration or `@ts-ignore`. Push notifications are feature-flagged off anyway.

### Data Population Gaps
- ~956 events with `orientation='mixed'` and zero impacts awaiting batch recategorization
- Many brands still lack ownership/leadership data
- SEC 13F sync requires paid FMP API subscription (currently expired)
- Many scanned brands have 0 events — "product killer" for user trust

### Architecture Concerns
- **391 migrations** — schema has evolved heavily; migration history is very long
- **65+ edge functions** — some overlap and redundancy (e.g., multiple scoring functions)
- **Duplicate feature flag files**: `src/lib/featureFlags.ts` AND `src/config/features.ts`
- **Dev baseline guard** in `main.tsx` blocks certain fetch URLs in development — fragile pattern
- **`as any` casts** on several RPC calls indicate type mismatches between generated types and actual DB functions
- **No test coverage**: Only 2 test files (`events.test.ts`, `staleness.test.ts`) plus Playwright smoke tests

### UX Issues
- Score narrative was using hardcoded impact labels (brand-level) instead of per-event data — recently fixed
- "Charitable donation" showing as negative — fixed by deriving impact from event data
- Brand profiles with no events show "baseline only" which feels broken
- Multiple admin pages with overlapping functionality

### Security
- Admin role check via `has_role()` security definer function (correct pattern)
- RLS enabled on tables
- `asset_managers` guard prevents setting financial institutions as parent companies
- Security audit log for sensitive operations
- Push notification keys encrypted in DB

---

## 12. Deployment

- **Frontend**: Lovable preview + Railway (Express server in `server.js` serving static files)
- **Backend**: Lovable Cloud (Supabase-powered)
- **CI/CD**: GitHub Actions workflows for daily health check, enrichment CI, nightly scoring
- **Docker**: Dockerfile present for Railway deployment

---

## 13. Summary Assessment

**Strengths:**
- Ambitious and well-conceived product with real consumer value
- Solid 4-axis scoring model with personalization
- Multi-source evidence pipeline (government data, news, Wikidata)
- Self-healing identity verification system
- 3-state profile machine handles data maturity gracefully
- Strong admin tooling (20+ admin pages)

**Weaknesses:**
- Data population is the bottleneck — many brands feel empty
- Too many edge functions with some redundancy
- Test coverage is minimal
- Push notifications broken at type level
- Two separate feature flag systems
- 391 migrations suggests rapid iteration without consolidation
- 13F shareholder data pipeline blocked by API subscription

**Current Stage**: Infrastructure complete, data population and verification incomplete. The engines work but need fuel (events, ownership data, leadership data) to deliver a credible user experience.


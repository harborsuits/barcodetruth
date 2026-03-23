# Barcode Truth — Full System Audit (March 2026)

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

391 migrations. Key tables:

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
| `user_roles` | Admin/moderator/user roles (separate table) |
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
- `get_brand_profile_state(brand_id)` — 3-state profile status
- `can_user_scan(user_id)` — scan limit check (5 free/month)
- `search_catalog(query)` — fuzzy search across products + brands
- `personalized_brand_score(brand_id, user_id)` — weighted score

---

## 4. Edge Functions (65+)

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

## 5. Scoring System

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

## 6. Brand Profile State Machine

```text
┌─────────────┐     identity verified     ┌──────────────┐
│  Needs       │ ──────────────────────► │  Building     │
│  Review      │     + 3+ dimensions      │  (progress)   │
└─────────────┘                          └──────┬────────┘
                                                │ 3+ evidence domains
                                                ▼
                                         ┌──────────────┐
                                         │  Assessable   │
                                         │  (full score) │
                                         └──────────────┘
```

- **Assessable**: Personalized scores, narratives, Power & Profit, evidence feed
- **Building**: Progress bars, blockers, dimension coverage audit
- **Needs Review**: IdentityFixCard with auto-fix and manual candidate selection

---

## 7. Authentication & Authorization

- **Auth**: Email/password (no auto-confirm)
- **Roles**: `user_roles` table (admin, moderator, user)
- **RLS**: Enabled on most tables
- **Admin check**: `has_role(auth.uid(), 'admin')` security definer function
- **Route guards**: `ProtectedRoute`, `AdminRoute`
- **Scan limits**: 5 free/month, unlimited for subscribers

---

## 8. Monetization

- **Free tier**: 5 barcode scans/month
- **Subscription**: Stripe checkout, webhooks, customer portal
- **Deep scan**: One-time payment
- **User billing**: `user_billing` table

---

## 9. PWA Features

- Service Worker + manifest
- Offline indicator
- Snapshot prewarming (`useSnapshotPrewarm`)
- Push notifications (VAPID-based, feature-flagged off)

---

## 10. Known Issues & Technical Debt

### Active
- `pushNotifications.ts` TypeScript errors (feature-flagged off)
- ~956 events awaiting batch recategorization
- SEC 13F sync blocked by expired FMP API subscription
- Duplicate feature flag files (`src/lib/featureFlags.ts` + `src/config/features.ts`)

### Architecture
- 391 migrations — heavy schema evolution
- 65+ edge functions with some redundancy
- Minimal test coverage (2 unit test files + Playwright smoke)
- `as any` casts on RPC calls
- Dev baseline guard in `main.tsx` is fragile

### Deployment
- Frontend: Lovable preview + Railway (Express static server)
- Backend: Lovable Cloud
- CI/CD: GitHub Actions (daily health, enrichment CI, nightly scoring)

---

## 11. Summary Assessment

**Strengths**: Ambitious product, solid 4-axis scoring, multi-source evidence pipeline, self-healing identity system, 3-state profile machine, strong admin tooling.

**Weaknesses**: Data population bottleneck, edge function redundancy, minimal tests, duplicate feature flags, 13F data blocked.

**Current Stage**: Infrastructure complete, data population and verification incomplete. The engines work but need fuel.

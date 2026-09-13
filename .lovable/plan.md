# BarcodeTruth — Detailed System Report

## 1. What BarcodeTruth Is

BarcodeTruth is a consumer transparency platform. A user scans a product barcode (or searches a brand name) and gets an ethics/accountability profile of the brand behind the product. The core question it answers: **"Who profits from my purchase, and what is their track record on labor, environment, politics, and social issues?"**

Tagline: *"Scan a barcode. See who you fund."*

### The three pillars of the value proposition

1. **Power & Profit** — ownership transparency: who owns the brand, who runs it (CEO/founders), who profits (institutional shareholders from SEC 13F filings), corporate structure chains, sister brands.
2. **Personalized Scoring** — 4-axis ethics scores (labor, environment, politics, social) reweighted by the user's own stated values.
3. **Evidence-backed everything** — every score is anchored to traceable, sourced real-world events. No opinions, no black box.

## 2. Why It Exists (Product Principles)

These are enforced as hard rules across the codebase:

- **Honesty-first**: hide unverified sections entirely. Never show fake progress, placeholder verification theater, or "not verified yet" filler.
- **Objective trust**: the core score uses independent public data only. Brand self-disclosures go to a separate Transparency Index — they can never inflate the core score.
- **No dead ends**: a failed scan always routes to `/unknown/:barcode` and logs the barcode to `unknown_barcodes` so demand drives future coverage.
- **Independence integrity**: conglomerate-owned brands (e.g. Poppi → PepsiCo) are reclassified as subsidiaries and excluded from "Better Options" indie recommendations.
- **Evidence-anchored reasoning**: every reasoning bullet in the UI must link to a concrete real-world event.
- **Verdict suppression**: verdicts are hidden when scores sit in the noise band (47–53) or a brand has fewer than 5 events — the app refuses to fake confidence.

## 3. Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND — React 18 + Vite 5 + TypeScript + Tailwind v3      │
│  • shadcn/ui components, TanStack Query for data/caching     │
│  • Lazy routes (React.lazy + custom lazyNamed)               │
│  • PWA: service worker, manifest, offline indicator          │
│  • Hosted: Lovable (barcodetruth.com custom domain)          │
├──────────────────────────────────────────────────────────────┤
│ BACKEND — Lovable Cloud (Supabase)                           │
│  • Auth: Supabase Auth (email/password)                      │
│  • PostgreSQL with RLS on every public table + GRANTs        │
│  • 65+ Deno edge functions (pipeline, scoring, payments)     │
│  • pg_cron scheduled ingestion/scoring/recompute jobs        │
├──────────────────────────────────────────────────────────────┤
│ DATA PIPELINE                                                │
│  • Ingestion: GDELT, Guardian, NewsAPI, NYT, GNews,          │
│    Google News RSS, Reddit RSS                               │
│  • Regulatory: EPA, OSHA, FDA recalls, FEC, SEC Edgar, 13F   │
│  • Enrichment: Wikipedia/Wikidata (ownership, people, logos) │
│  • Classification: event_rules table, 37+ pattern rules      │
│  • Scoring: hybrid √count + severity + recency decay         │
└──────────────────────────────────────────────────────────────┘
```

## 4. The Core User Flow

```text
/scan ──► smart-product-lookup ──► get-product-by-barcode (fallback)
              │ miss                        │ miss
              ▼                             ▼
       /unknown/:barcode ◄──────────────────┘
              │  user submits product info
              ▼
       /scan-result/:barcode ──► brand profile + verdict
              │
              ▼
       /brand/:slug — full profile:
         header, 4 category score cards, community outlook,
         ownership tabs, key people, shareholders, valuation,
         coverage metrics, evidence feed with category filters
```

### Product resolution model
`barcode → product → brand → company`, with 4-tier hybrid lookup: internal DB → Open Food Facts → Barcode Lookup → UPCitemdb. Barcodes are normalized bidirectionally (12-digit UPC ↔ 13-digit EAN). Common-word brand names (Simply, Quest) get strict-match gating to avoid false attribution.

## 5. Scoring System

- **Scale**: Good (65–100), Mixed (40–64), Avoid (<40). Baseline 50 for new/unscored brands.
- **V3 engine**: server-side canonical computation, direct queries, SCALE 5.0, cube-root normalization of event counts.
- **Event inheritance**: subsidiaries inherit parent events at 0.7× weight; 50-event cap ordered Direct > Recency > Inherited.
- **Signal sensitivity**: high-impact events are boosted when scores cluster near 50; zero-impact signals (impact < 2) never increment the denominator.
- **Reservoir layer**: a pattern-memory system that adjusts scores by at most ±5 with 1% daily decay.
- **Personalization**: 5-gate eligibility check, confidence multiplier, dimension reweighting from `user_preferences` (0–100 weights per axis). Authenticated users see their personalized verdict; anonymous users see the raw score.
- **Community validation**: upvotes ≥80% give a 1.15× boost; ≤20% give a 0.5× penalty.
- **Integrity protections**: real computed scores are never overwritten by the neutral-50 baseline during scan caching; score history is trigger-logged to `brand_scores_history`.
- **Ingestion gating**: news articles score 0–20 on relevance; only ≥11 is ingested. Regulatory data (EPA/OSHA/FDA/FEC) is official-by-definition and gets max score. A DB trigger blocks 0–1-scale writes.

## 6. Database Schema (~110 tables, 391 migrations)

### Brand core
| Table | Purpose |
|---|---|
| `brands` (57 cols) | name, slug, logo, wikidata_qid, status, identity_confidence, enrichment_stage |
| `brand_aliases`, `brand_slug_aliases` | alternate names, old-slug redirects |
| `brand_events` (61 cols) | the evidence: title, category, orientation, severity, verification, source URL, relevance scores |
| `brand_scores`, `brand_scores_history` | per-category scores + audit trail |
| `brand_ownerships` | brand↔brand parent relationships |

### Corporate spine
| Table | Purpose |
|---|---|
| `companies` | parent companies (ticker, exchange, type, country) |
| `company_ownership` | brand→company links with confidence; identity priority: Wikidata > LEI > SEC CIK > ticker |
| `company_people` | CEO/founders/chairs with photos + Wikidata QIDs |
| `company_shareholders` | institutional holders from SEC 13F |
| `company_valuation` | market cap with as-of dates |

### Products & scans
| Table | Purpose |
|---|---|
| `products` | UPC/EAN → brand mapping |
| `product_claims`, `product_claim_votes` | user-submitted associations + community voting |
| `unknown_barcodes` | demand-capture log for missed scans |
| `user_scans` | per-user scan history |

### Users & billing
| Table | Purpose |
|---|---|
| `profiles`, `user_profiles` | user records (roles live separately in `user_roles` — never on profiles) |
| `user_preferences` | 4-axis value weights |
| `user_billing`, `stripe_customers`, `stripe_events` | Stripe subscription state (service-role only) |
| `user_push_subs`, `notification_log` | web push delivery |

### Evidence quality & ops
`event_sources`, `source_credibility`, `event_disputes`, `event_votes`, `classification_audit`, `community_ratings`, `rss_feeds`/`rss_items`, `article_brand_matches`, `enrichment_runs`, `jobs`, `score_runs`, `health_check_results`, `data_quality_metrics`, `security_audit_log`, `api_rate_limits`, `coverage_requests`, `coverage_daily_snapshots`.

### Key views / RPCs
- Views: `brand_data_coverage` (materialized), `brand_standings`, `brand_trending`, `brand_monitoring_status`.
- RPCs: `brand_profile_view`, `get_brand_ownership`, `get_top_shareholders`, `personalized_brand_score_v3`, `get_product_by_barcode`, `get_fair_feed`, `get_smart_alternatives`, `has_role` (security-definer role check).

## 7. Edge Functions (65+)

Grouped by purpose:
- **Scan/product**: `scan-product`, `get-product-by-barcode`, `smart-product-lookup`, `submit-unknown-product`, `resolve-barcode`
- **Ingestion**: `unified-news-orchestrator`, `batch-process-brands`, `fetch-google-news-rss`, `fetch-reddit-rss`, `fetch-epa/osha/fec/fda-*`, `bulk-ingest-*`, `fetch-sec-edgar`, `sync-13f`
- **Enrichment**: `enrich-brand-wiki`, `resolve-brand-logo`, `resolve-company-gleif`, `resolve-company-sec`, `enrich-top-brands`
- **Scoring**: `recompute-brand-scores`, `bulk-calculate-scores`, `recompute-brand-vectors`, `calculate-baselines`
- **Payments**: `create-checkout`, `customer-portal`, `stripe-webhook`, `check-subscription`
- **Admin (JWT-gated)**: `delete-brand-data` (kill-switched), `admin-*`, `rotate-brand-ingestion`, `verify-event`, `delete-user`

Recent security hardening: all expensive/mutating jobs now require JWT + `requireAdminOrInternal` (service-role cron token or admin role); error responses are sanitized; public storage listing was removed.

## 8. Frontend Routes

Public: `/` (auth-aware home), `/scan`, `/search`, `/brand/:slug`, `/unknown/:barcode`, `/scan-result/:barcode`, `/how-scores-work`, `/why-trust-us`, `/methodology`, `/terms`, `/privacy`, trending/discover/feed.
Authed: onboarding, settings (value sliders), lists, my scans.
Admin (~25 pages): ingestion health, enrichment monitor, ownership audit, disputes, coverage metrics, seeding, fuzzy review, events, users, ops health — all behind `AdminRoute` + `has_role('admin')`.

## 9. Known Gaps / Honest Status

- ~1,378 ready brands, but only ~171 have alternatives data → "Better Options" is empty for most brands.
- Logo coverage ~40%; parent-company data ~7% (enrichment jobs exist but are quota-limited; news ingestion uses 12-hour batch rotation to spread API quota).
- Two linter findings intentionally ignored: security-definer RPCs executable by anon/auth — this is deliberate; those RPCs are the public API surface with internal scoping.
- All P0 security findings from the recent audit (unauthenticated destructive/expensive endpoints, public-write RLS policies, XSS in markdown rendering, dispute email exposure) have been fixed and marked.

## 10. Verdict

BarcodeTruth is an evidence-first brand accountability engine: a barcode scanner on the front, a continuously-ingesting corporate-evidence pipeline in the middle, and a hardened, personalization-aware scoring engine at the core. Its defining stance is refusing to fake confidence — it would rather show nothing than show something unverified.

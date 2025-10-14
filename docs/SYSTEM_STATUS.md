# BarcodeTruth System Status Report

**Generated**: 2025-01-14  
**Purpose**: Documentation for external developers/consultants

---

## 🟢 WORKING: Stripe Integration

### What's Implemented
- ✅ **Edge Functions**:
  - `create-checkout` - Creates Stripe checkout sessions for subscriptions ($5/month)
  - `check-subscription` - Verifies active subscriptions and returns status
  - `customer-portal` - Generates Stripe portal URLs for subscription management
  
- ✅ **Frontend Integration**:
  - `useSubscription` hook in `src/hooks/useSubscription.ts`
  - Settings page (`src/pages/Settings.tsx`) with subscription UI
  - `useScanLimit` hook in `src/hooks/useScanLimit.ts` enforces 5 scans/month for free users
  
- ✅ **Database Tables**:
  - `user_billing` - Tracks subscription status per user
  - `stripe_customers` - Maps users to Stripe customer IDs
  - `stripe_events` - Logs Stripe webhook events
  - `user_scans` - Tracks scan usage per user
  
- ✅ **Configuration**:
  - Stripe secret key configured in edge functions
  - Price ID: Set via `STRIPE_PRICE_ID` environment variable
  - Webhook handling ready (if needed)

### Stripe Product Setup
- **Current**: Subscription product exists with monthly pricing
- **Access**: Via Stripe API tools or Stripe dashboard
- **Integration**: `create-checkout` function uses `STRIPE_PRICE_ID` from secrets

---

## 🟡 PARTIALLY WORKING: Core User Features

### 1. Barcode Scanning (`/scan`)

**Status**: UI Complete, Backend Incomplete

**What Works**:
- ✅ Camera access and ZXing barcode detection
- ✅ Manual barcode entry fallback
- ✅ Image upload scanning
- ✅ Scan limit enforcement (5 free scans/month)
- ✅ Offline queueing support
- ✅ Scanner diagnostics

**What's Missing**:
- ❌ `resolve-barcode` edge function **returns no data** for most barcodes
- ❌ `products` table is **empty** (no barcode → brand mappings)
- ❌ Product claims moderation system not fully connected

**Fix Required**:
1. Populate `products` table with barcode → brand mappings
2. Verify `resolve-barcode` edge function works with sample barcodes
3. Test full flow: scan → resolve → brand page

**Files**:
- Frontend: `src/pages/Scan.tsx`
- Backend: `supabase/functions/resolve-barcode/index.ts`
- Database: `products`, `product_claims`, `product_claim_votes`

---

### 2. Brand Search (`/search`)

**Status**: Frontend Complete, Backend Data Needed

**What Works**:
- ✅ Fuzzy search UI with trigram matching
- ✅ Search rate limiting
- ✅ Alias support for brand name variations
- ✅ "Did you mean?" suggestions

**What's Missing**:
- ❌ `brands` table has **limited data** (needs seed data)
- ❌ `brand_aliases` table needs expansion for CPG brands
- ❌ Search returns few results due to small dataset

**Fix Required**:
1. Seed `brands` table with major consumer brands
2. Add common aliases (e.g., "Coca Cola" → "The Coca-Cola Company")
3. Test search with real brand names

**Files**:
- Frontend: `src/pages/Search.tsx`
- Backend: `supabase/functions/search-brands/index.ts`
- Library: `src/lib/searchBrands.ts`

---

### 3. Brand Detail Pages (`/brands/:brandId`)

**Status**: Frontend Complete, Backend Data Incomplete

**What Works**:
- ✅ Score display (labor, environment, politics, social)
- ✅ Event timeline visualization
- ✅ Follow/notification toggle
- ✅ Trust indicators and data quality badges
- ✅ Parent company rollup

**What's Missing**:
- ❌ Most brands have **no events** in `brand_events` table
- ❌ Scores default to 50 (no real calculation)
- ❌ Evidence sources (`event_sources`) mostly empty
- ❌ Score calculation edge function needs real data

**Fix Required**:
1. Ingest events from EPA, OSHA, FEC, FDA sources
2. Run score calculation for seeded brands
3. Verify evidence resolution pipeline

**Files**:
- Frontend: `src/pages/BrandDetail.tsx`
- Backend: `supabase/functions/calculate-brand-score/index.ts`
- Database: `brand_events`, `event_sources`, `brand_scores`

---

## 🔴 NOT WORKING: Data Pipeline

### Event Ingestion

**Status**: Edge functions exist, but **not running automatically**

**Available Functions** (manual invoke only):
- `fetch-news-events` - Ingest from RSS feeds
- `fetch-osha-events` - OSHA violation data
- `check-fda-recalls` - FDA recall data
- `fetch-epa-events` - EPA enforcement cases
- `fetch-fec-events` - FEC political donations

**What's Missing**:
- ❌ **No cron jobs configured** to run these automatically
- ❌ RSS feeds table (`rss_feeds`) needs configuration
- ❌ Brand matching pipeline not triggered
- ❌ Evidence resolution not running

**Fix Required**:
1. Set up pg_cron jobs to run ingestion functions
2. Configure RSS feeds in `rss_feeds` table
3. Enable automatic brand matching (`brand-match` function)
4. Run evidence resolution (`resolve-evidence-links`)

**Documentation**: See `docs/CRON_JOBS_SETUP.sql` and `docs/NEWS_INGESTION_SETUP.md`

---

### Score Calculation

**Status**: Function exists, not running

**What Works**:
- ✅ `calculate-brand-score` edge function implemented
- ✅ Complex scoring logic with decay, credibility weighting
- ✅ Baseline calculation from historical data

**What's Missing**:
- ❌ Not running automatically (no cron job)
- ❌ Requires event data first (see above)
- ❌ `brand_scores` table mostly empty

**Fix Required**:
1. Set up cron job to recalculate scores daily
2. Ensure event pipeline runs first
3. Verify calculation for test brands

**Files**: `supabase/functions/calculate-brand-score/index.ts`

---

## 📊 Database Status

### Tables with Data
- ✅ `brands` - ~50-100 brands (needs expansion)
- ✅ `user_roles` - Admin roles configured
- ✅ `scoring_caps` - Scoring configuration
- ✅ `source_credibility` - Source trust ratings

### Tables Nearly Empty
- ⚠️ `products` - **Critical**: No barcode data
- ⚠️ `brand_events` - Few events per brand
- ⚠️ `event_sources` - Limited evidence
- ⚠️ `rss_items` - No RSS ingestion yet
- ⚠️ `brand_aliases` - Needs CPG brand aliases

### RLS Policies
- ✅ All tables have proper Row Level Security
- ✅ Admin roles can manage data
- ✅ Public read access where appropriate
- ✅ User-specific data properly isolated

---

## 🔧 Admin Tools

### Health Dashboard (`/admin/health`)

**Status**: Fully Functional

**What Works**:
- ✅ System health checks
- ✅ Database statistics
- ✅ Pipeline monitoring
- ✅ Scanner diagnostics
- ✅ Edge function logs viewer

**Files**: `src/pages/AdminHealth.tsx`

---

## 📋 Implementation Checklist for External Help

### Phase 1: Minimum Viable Product (1-2 days)
1. **Seed Product Data**
   - [ ] Import 1000+ common barcodes → brands
   - [ ] Add to `products` table with brand_id mappings
   - [ ] Test `resolve-barcode` with real UPC codes

2. **Seed Brand Data**
   - [ ] Add top 100 CPG brands to `brands` table
   - [ ] Create aliases in `brand_aliases`
   - [ ] Verify search works for "Coca Cola", "Pepsi", etc.

3. **Test Core Flow**
   - [ ] Scan barcode → resolves to brand
   - [ ] Search "Nike" → shows Nike brand page
   - [ ] Brand page shows placeholder scores (50)

### Phase 2: Data Pipeline (2-3 days)
4. **Configure RSS Ingestion**
   - [ ] Add RSS feeds to `rss_feeds` table
   - [ ] Set up pg_cron to run `pull-feeds` hourly
   - [ ] Verify articles appear in `rss_items`

5. **Enable Event Ingestion**
   - [ ] Configure cron for FDA recalls (daily)
   - [ ] Configure cron for EPA cases (daily)
   - [ ] Configure cron for OSHA data (weekly)
   - [ ] Run `brand-match` to link articles to brands

6. **Evidence Resolution**
   - [ ] Run `resolve-evidence-links` to upgrade homepages
   - [ ] Verify `event_sources` gets populated
   - [ ] Check Wayback archiving

### Phase 3: Scoring System (1-2 days)
7. **Calculate Initial Scores**
   - [ ] Run `calculate-brand-score` for all brands
   - [ ] Verify non-50 scores appear
   - [ ] Set up daily recalculation cron

8. **Verify Score Display**
   - [ ] Brand pages show real scores
   - [ ] Score breakdown works
   - [ ] Event timeline shows real data

### Phase 4: Polish (1 day)
9. **User Testing**
   - [ ] End-to-end scan flow works
   - [ ] Subscription flow complete
   - [ ] Notifications system tested

---

## 🔑 Environment Variables

### Required Secrets (Already Set)
- `STRIPE_SECRET_KEY` ✅
- `STRIPE_PRICE_ID` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` ✅
- `NYT_API_KEY`, `NEWSAPI_KEY`, `GNEWS_API_KEY` ✅
- `FEC_API_KEY` ✅
- `INTERNAL_FN_TOKEN` ✅
- `PUSH_ENC_KEY` ✅

### Configuration
All secrets are managed in Supabase and accessible via `Deno.env.get()` in edge functions.

---

## 📞 Contact Points for Questions

### Database Issues
- Check `docs/COMPREHENSIVE_HEALTH_CHECK.sql` for diagnostics
- Admin health dashboard: `/admin/health`
- Run health check edge function: `comprehensive-health`

### Stripe Issues
- Test checkout: Click "Subscribe Now" in `/settings`
- Check subscription: Edge function `check-subscription`
- Portal: Edge function `customer-portal`

### Pipeline Issues
- RSS ingestion: See `docs/NEWS_INGESTION_SETUP.md`
- Cron jobs: See `docs/CRON_JOBS_SETUP.sql`
- Evidence resolver: See `docs/EVIDENCE_RESOLVER.md`

---

## 🎯 Priority Order for External Developer

1. **Highest Priority**: Populate `products` table (enables scanning)
2. **High Priority**: Seed brands and run test searches
3. **Medium Priority**: Set up RSS ingestion pipeline
4. **Medium Priority**: Run score calculations for seeded brands
5. **Lower Priority**: Optimize evidence resolution

---

## 📚 Additional Documentation

- **Setup Guides**: `docs/` folder contains 20+ setup documents
- **SQL Diagnostics**: `docs/COMPREHENSIVE_HEALTH_CHECK.sql`
- **Launch Checklist**: `docs/PRODUCTION_CHECKLIST.md`
- **Security Review**: `docs/LAUNCH_READINESS_REPORT.md`
- **Stripe Setup**: `docs/STRIPE_SETUP.md`

---

**Note**: The system architecture is solid, but lacks **seed data** and **automated pipelines**. With proper data and cron jobs, all features should work end-to-end.

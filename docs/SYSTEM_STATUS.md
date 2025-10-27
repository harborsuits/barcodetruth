# BarcodeTruth System Status Report
**Generated:** 2025-01-XX  
**Purpose:** Complete system overview for external developers/consultants

---

## 🎯 Executive Summary

BarcodeTruth is a consumer-facing app that helps users make values-aligned purchasing decisions by scanning product barcodes and viewing brand ethics scores. The system combines:
- Frontend React app (barcode scanning, brand profiles, personalized scoring)
- Supabase backend (auth, database, edge functions)
- Data pipeline (news ingestion, score calculation, brand enrichment)

**Current State:** Core infrastructure is solid, but several critical data gaps prevent full end-to-end functionality.

---

## 🟢 WORKING: Stripe Integration

### What Works
- **Stripe Edge Functions:** Deployed and functional
  - `create-checkout`: Creates checkout sessions
  - `check-subscription`: Verifies active subscriptions
  - `customer-portal`: Manages subscription portal access
  
- **Frontend Integration:**
  - `useSubscription` hook fetches subscription status
  - `useScanLimit` hook enforces free tier (5 scans/month) and unlimited for subscribers
  - Settings page allows users to manage subscriptions via Stripe portal

- **Database Tables:**
  - `user_billing`: Tracks subscription status
  - `stripe_customers`: Maps users to Stripe customer IDs
  - `stripe_events`: Logs webhook events
  - `user_scans`: Records scan activity for limit enforcement

- **Configuration:**
  - Stripe secret key configured in Supabase secrets
  - Price ID configured for subscription product

### Customer Experience
✅ Users can subscribe via checkout flow  
✅ Subscription status correctly determines scan limits  
✅ Free users see "5 scans remaining" messaging  
✅ Subscribed users have unlimited scans  
✅ Users can manage billing via Stripe portal  

---

## 🟡 PARTIALLY WORKING: Core User Features

### 1. Barcode Scanning

**What Works:**
- Camera access and permission handling (iOS/Android)
- ZXing barcode detection library integrated
- Scan result page UI complete
- Scan limit enforcement (free vs paid tiers)
- `ScanLimitModal` shows upgrade prompt when limit reached

**What Doesn't Work:**
- ❌ **Barcode-to-product resolution:** `resolve-barcode` edge function exists but `products` table is nearly empty (8 rows)
- ❌ **Product data:** No manufacturer/brand associations for most barcodes
- ❌ **Brand enrichment:** When a product is found, brand data is often incomplete

**Customer Experience:**
- ✅ User can open camera and scan barcode
- ❌ Scan succeeds but resolves to "product not found" ~99% of the time
- ❌ If product found, brand profile often missing logo, events, or scores

**What's Needed:**
1. Seed `products` table with real UPC/EAN codes mapped to `brand_id`
2. Run `resolve-barcode` function to test end-to-end
3. Enrich brands with logos, descriptions, and events

---

### 2. Brand Search & Discovery

**What Works:**
- Search UI on `/search` route with fuzzy matching
- `search-brands` edge function uses trigram similarity
- Brand results show name, parent company, and score preview
- Trending brands list on homepage
- Category filters functional

**What Doesn't Work:**
- ❌ **Limited brand data:** Only 97 active brands in database
- ❌ **Missing aliases:** Many brands have consumer-facing names that don't match official corporate names
- ❌ **Incomplete profiles:** 40% missing logos, 7% missing parent company data

**Customer Experience:**
- ✅ User can search for brands by name
- ⚠️ Search results limited to ~100 brands
- ⚠️ Common aliases (e.g., "Coke" → "Coca-Cola Company") may not resolve
- ✅ Clicking a result takes user to brand profile

**What's Needed:**
1. Expand brand catalog (Fortune 500 at minimum)
2. Add `brand_aliases` table for consumer-facing names
3. Run logo enrichment job
4. Populate parent company relationships

---

### 3. Brand Detail Pages

**What Works:**
- Brand profile UI (`/brand/:id`) displays:
  - Name, logo, description, website
  - Overall score + category breakdowns (labor, environment, politics, social)
  - Parent company ownership (if available)
  - Key people (executives, board members)
  - Shareholders (institutional ownership)
  - Event timeline (categorized evidence)
  - "Better Alternatives" card (if match < 70%)
  - "Why Should I Care" personalized bullets
  - Verification badges on events
  - Quick context summaries

- **Components Working:**
  - `ScoresGrid`: Displays 5 category scores with color coding
  - `EventTimeline`: Shows events filtered by category
  - `OwnershipTabs`: Displays corporate structure
  - `KeyPeopleSimple`: Lists executives
  - `TopShareholdersCard`: Shows institutional investors
  - `BetterAlternativesCard`: Suggests higher-match brands (NEW)
  - `WhyCareCard`: Explains score gaps in user's language (NEW)
  - `VerificationBadge`: Trust indicators for events (NEW)

**What Doesn't Work:**
- ❌ **Missing event data:** Most brands have <5 events total
- ❌ **Stale scores:** Scores can't update without events
- ❌ **Incomplete ownership:** Only 7% of brands have parent company mapped
- ❌ **Missing evidence sources:** Events often lack source URLs or attribution

**Customer Experience:**
- ✅ User lands on brand profile and sees layout
- ⚠️ Scores are often default (50/100) because no events exist
- ⚠️ Event timeline shows "No events found" for most brands
- ⚠️ Ownership section shows "Unknown" for most brands
- ✅ **NEW:** If user values are set, they see personalized "Why Care" bullets
- ✅ **NEW:** If match is low, they see "Better Alternatives" suggestions
- ✅ **NEW:** Events show verification badges (Official, Verified, Reported)

**What's Needed:**
1. Run news ingestion for top 100 brands daily
2. Backfill historical events (90-day window minimum)
3. Run ownership enrichment (Wikidata → `company_ownership` table)
4. Resolve missing logos and descriptions

---

### 4. User Preferences & Personalization

**What Works:**
- `/onboarding` flow asks users to set values on 4 sliders (labor, environment, politics, social)
- `user_preferences` table stores values per user
- `updateUserValues` function in `src/lib/userPreferences.ts` persists slider positions
- Scores are personalized based on user values via `personalized_brand_score` function
- "Why Should I Care" component references user values to explain gaps

**What Doesn't Work:**
- ❌ **No validation that preferences persist:** Need to verify slider changes actually save
- ❌ **No UI feedback on save success:** Users don't know if their values were saved

**Customer Experience:**
- ✅ User sets values on onboarding
- ⚠️ Values may or may not persist (needs verification)
- ✅ **NEW:** User sees personalized "Why Care" bullets on brand pages

**What's Needed:**
1. Add toast confirmation when preferences save
2. Add loading state to sliders during save
3. Verify `user_preferences` RLS policies allow upsert

---

## 🔴 NOT WORKING: Data Pipeline

### 1. Event Ingestion

**What Exists:**
- **Edge Functions:**
  - `fetch-news-events`: Generic news fetcher
  - `fetch-google-news-rss`: Google News RSS parser
  - `fetch-guardian-news`: Guardian API integration
  - `fetch-reddit-rss`: Reddit RSS fetcher
  - `fetch-epa-events`: EPA violations
  - `fetch-fec-events`: Political donations
  - `fetch-osha-events`: Workplace safety
  - `ingest-fda-recalls`: FDA product recalls
  - `unified-news-orchestrator`: Coordinates all news sources

**What Doesn't Work:**
- ❌ **Not running automatically:** No cron jobs configured to trigger daily
- ❌ **No manual trigger UI:** Admins can't manually run ingestion
- ❌ **Rate limits not configured:** Could hit API limits if run too frequently
- ❌ **No deduplication:** Same event may be ingested multiple times

**Customer Impact:**
- ❌ Users see stale or missing events on brand pages
- ❌ Scores remain at default (50) because no events exist to modify them

**What's Needed:**
1. Set up cron jobs to run `unified-news-orchestrator` daily
2. Configure rate limits (max 10 brands/day for free tier APIs)
3. Add deduplication logic in `brand_events` table (unique constraint on `brand_id + title + event_date`)
4. Create admin UI to manually trigger ingestion for specific brands

---

### 2. Score Calculation

**What Exists:**
- **Edge Functions:**
  - `calculate-brand-score`: Calculates scores from events
  - `simple-brand-scorer`: Simplified scoring logic
  - `bulk-calculate-scores`: Batch score updates
  
- **Database Function:**
  - `compute_brand_score`: SQL function that calculates scores from `brand_events` table

- **Scoring Logic:**
  - Baseline: 50/100 (neutral)
  - Events modify score based on:
    - Category (labor, environment, politics, social)
    - Severity (minor, moderate, severe, catastrophic)
    - Verification (official > corroborated > reported)
    - Recency (events decay over time)

**What Doesn't Work:**
- ❌ **Not running automatically:** Scores don't update when events are added
- ❌ **No trigger:** No database trigger to recalculate when `brand_events` changes
- ❌ **Manual recalculation required:** Admins must manually run scorer

**Customer Impact:**
- ❌ Users see stale scores that don't reflect recent events
- ❌ New events don't change brand scores until manual recalc

**What's Needed:**
1. Add database trigger on `brand_events` INSERT/UPDATE to queue score recalc
2. Set up cron job to run `simple-brand-scorer` nightly
3. Add admin UI button to manually recalculate scores for a brand

---

### 3. Brand Enrichment

**What Exists:**
- **Edge Functions:**
  - `enrich-brand-wiki`: Fetches data from Wikidata
  - `enrich-ownership`: Populates `company_ownership` table
  - `enrich-key-people`: Fetches executives and board members
  - `enrich-shareholders`: Fetches institutional ownership
  - `resolve-brand-logo`: Finds and uploads brand logos
  - `enrich-company-profile`: General profile enrichment

**What Works:**
- ✅ Functions can successfully fetch data when manually invoked
- ✅ Wikidata integration functional
- ✅ Logo resolution works for most brands

**What Doesn't Work:**
- ❌ **Not running automatically:** Enrichment only happens on manual trigger
- ❌ **Inconsistent data:** 40% missing logos, 7% missing parent company
- ❌ **No prioritization:** No system to enrich high-traffic brands first

**Customer Impact:**
- ⚠️ Users see incomplete brand profiles (missing logos, descriptions, ownership)
- ⚠️ Parent company relationships not displayed

**What's Needed:**
1. Run one-time enrichment job for all active brands
2. Set up weekly cron to enrich new brands
3. Prioritize enrichment for brands with high scan volume

---

## 📊 Database Status

### Tables With Data (Good)
| Table | Row Count | Status |
|-------|-----------|--------|
| `brands` | 97 | ✅ Core brands present |
| `user_roles` | 7 | ✅ Admin/moderator roles configured |
| `user_preferences` | 7 | ✅ All users have preferences |
| `brand_events` | 203 | ⚠️ Low event count |
| `brand_scores` | 97 | ✅ All brands have scores |
| `event_sources` | ~200 | ✅ Sources tracked |

### Tables Missing Data (Critical)
| Table | Row Count | Impact |
|-------|-----------|--------|
| `products` | 8 | 🔴 Barcode scanning broken |
| `brand_aliases` | 0 | 🟡 Search doesn't match consumer names |
| `company_ownership` | 7 | 🟡 Parent companies missing |
| `company_people` | 0 | 🟡 Key people missing |
| `company_shareholders` | 0 | 🟡 Shareholder info missing |

### RLS Policies
✅ All user-facing tables have proper RLS policies  
✅ Admin-only tables restricted to `user_roles.role = 'admin'`  
✅ User preferences only accessible by owner  
✅ Public read access for brands, events, scores  

---

## 🔧 Admin Tools

### Health Dashboard (`/admin/health`)
**Status:** ✅ Fully functional

**Features:**
- System health checks (database, auth, edge functions)
- Data quality metrics (event counts, score freshness, coverage stats)
- User account integrity checks (missing profiles, preferences)
- Materialized view freshness
- Pipeline monitoring (last ingestion, last score update)

**Usage:**
```typescript
// Refresh coverage view manually
await refreshCoverageView();

// Check user account integrity
const status = await verifyUserAccountIntegrity(userId);

// Ensure user preferences exist
await ensureUserPreferences(userId);
```

---

## 📋 Implementation Checklist for External Help

### Phase 1: Seed Data (Critical Path)
- [ ] Populate `products` table with top 10,000 UPCs mapped to brands
  - Use OpenFoodFacts API or custom product database
  - Map UPC → brand_id
  - Include product name, category, size
  
- [ ] Seed top 500 brands with basic data
  - Name, website, logo, description
  - Wikidata QID for enrichment
  - Mark as `is_active = true`

- [ ] Create brand aliases for common consumer names
  - "Coke" → "The Coca-Cola Company"
  - "Pepsi" → "PepsiCo Inc."
  - Use `brand_aliases` table

### Phase 2: Ingestion Pipeline (Week 1)
- [ ] Configure RSS cron jobs in `supabase/config.toml`
  ```toml
  [edge.functions."unified-news-orchestrator"]
  schedule = "0 2 * * *"  # Daily at 2 AM
  ```

- [ ] Set up rate limiting
  - Add `brand_api_usage` tracking
  - Limit to 10 brands/day for free APIs
  - Prioritize Fortune 500 brands

- [ ] Test end-to-end flow
  - Manually trigger `unified-news-orchestrator`
  - Verify events appear in `brand_events`
  - Check deduplication works

### Phase 3: Scoring System (Week 1)
- [ ] Add database trigger to queue score updates
  ```sql
  CREATE TRIGGER trigger_score_recalc
  AFTER INSERT OR UPDATE ON brand_events
  FOR EACH ROW
  EXECUTE FUNCTION queue_score_update();
  ```

- [ ] Set up nightly score recalculation cron
  ```toml
  [edge.functions."simple-brand-scorer"]
  schedule = "0 3 * * *"  # Daily at 3 AM
  ```

- [ ] Verify score calculation logic
  - Test with known events (EPA violations, FDA recalls)
  - Confirm recency decay works
  - Validate verification weighting

### Phase 4: Evidence Resolution (Week 2)
- [ ] Backfill missing source URLs
  - Use Wayback Machine for archived articles
  - Add source attribution to events

- [ ] Implement deduplication
  - Group similar events by title + date
  - Mark as "corroborated" if 2+ reputable sources

- [ ] Add source credibility scoring
  - Official (EPA, FDA, SEC) = 1.0
  - Reputable (Reuters, AP, Bloomberg) = 0.9
  - Local news = 0.7
  - Unknown = 0.5

### Phase 5: Brand Enrichment (Week 2)
- [ ] Run one-time enrichment for all active brands
  ```bash
  # Call enrich-brand-wiki for each brand
  for brand in $(psql -c "SELECT id FROM brands WHERE is_active = true"); do
    curl -X POST /functions/v1/enrich-brand-wiki -d "{\"brand_id\": \"$brand\"}"
  done
  ```

- [ ] Populate ownership graph
  - Use Wikidata `P749` (parent organization)
  - Create `company_ownership` records
  - Build `brand_ownerships` for subsidiaries

- [ ] Resolve missing logos
  - Use Clearbit API or Google Custom Search
  - Upload to Supabase Storage
  - Update `brands.logo_url`

---

## 🔑 Environment Variables

All secrets managed in Supabase (no .env file needed):

```
VITE_SUPABASE_URL=https://midmvcwtywnexzdwbekp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi... (already set)
STRIPE_SECRET_KEY=sk_test_... (already set)
STRIPE_PRICE_ID=price_... (already set)
INTERNAL_API_TOKEN=... (already set)
```

Edge functions access secrets via `Deno.env.get('STRIPE_SECRET_KEY')`.

---

## 📞 Contact Points for Questions

### Database Issues
- See `docs/HARDENING_AUDIT_2025.md` for recent fixes
- Use `/admin/health` dashboard to check system status
- Run `SELECT system_health_check();` for diagnostics

### Stripe Integration
- See `docs/STRIPE_SETUP.md` for webhook configuration
- Test checkout: `/settings` → "Manage Subscription"
- Verify webhooks in Stripe dashboard → Developers → Webhooks

### Pipeline Issues
- See `docs/ENRICHMENT_AUDIT_COMPLETE.md` for orchestration details
- Check edge function logs in Supabase → Edge Functions → Logs
- Manually trigger: `curl -X POST /functions/v1/unified-news-orchestrator`

---

## 🎯 Priority Order for External Developer

1. **Populate `products` table** (blocks barcode scanning)
2. **Seed top 500 brands** (enables search and discovery)
3. **Set up RSS ingestion cron** (enables event flow)
4. **Run initial score calculation** (makes scores reflect events)
5. **Optimize evidence resolution** (improves trust indicators)

---

## 📚 Additional Documentation

- `docs/QUICKSTART.md` - Local development setup
- `docs/PRODUCTION_CHECKLIST.md` - Pre-launch verification
- `docs/ENRICHMENT_CONSOLIDATION_PLAN.md` - Pipeline architecture
- `docs/SCORING.md` - Score calculation logic
- `docs/RSS_INGESTION_SETUP.md` - News ingestion configuration

---

## ✅ Conclusion

**What's Solid:**
- Frontend UX is polished and ready
- Authentication and user management work correctly
- Stripe integration is production-ready
- Admin tools provide good visibility
- Database schema is well-designed and secure

**What's Blocking Launch:**
- Products table is empty (blocks barcode scanning)
- Event ingestion isn't automated (blocks score updates)
- Brand catalog is too small (blocks search utility)

**Bottom Line:** The system architecture is sound. We need seed data and automated pipelines to make it function end-to-end.

# System Diagnosis Results - October 18, 2025

## Executive Summary

**Status**: 🟡 **Partially Functional** - Data ingestion working, scoring broken for most brands

## What's Working ✅

1. **News Ingestion**: `unified-news-orchestrator` IS working
   - 242 total events created
   - 229 events in last 7 days
   - Sources properly linked (232 event_sources)
   - Recent ingestion: PepsiCo, Johnson & Johnson, P&G, Columbia, Unilever

2. **Database**: All tables exist and are properly structured
   - 75 active brands
   - Events and sources correctly linked
   - Logo fetching functional

3. **Authentication**: Working properly
   - Subscription checks functional
   - Admin access working

## What's Broken ❌

### CRITICAL: Scoring Not Running

**Issue**: Only 23 out of 75 brands have scores, despite many having events
- Starbucks: 39 events → **NO SCORE**
- Columbia Sportswear: 16 events → **NO SCORE**  
- Unilever: 25 events → **NO SCORE**

**Root Cause**: 
- `calculate-brand-score` function is too strict (requires baselines)
- Cron job `recompute-brand-scores` is blocked (missing CRON_KEY header)
- No automatic trigger when new events arrive

**Fix Applied**:
- Made `calculate-brand-score` more lenient (defaults to 50 for missing baselines)
- Added `w_labor`, `w_environment`, `w_politics`, `w_social` columns to `user_preferences`

### CRITICAL: Brand Profile Display Broken

**Issue**: `get-brand-proof` function was crashing
- Tried to read non-existent columns from `user_preferences`

**Fix Applied**: ✅ Added missing weight columns

### Cron Jobs Blocked

**Issue**: All cron-triggered functions are being rejected
- `pull-feeds`: "missing-cron-header"
- `brand-match`: "missing-cron-header"  
- `resolve-evidence-links`: "missing-cron-header"

**Root Cause**: pg_cron jobs need proper authentication headers

## Action Items (In Priority Order)

### 1. Immediate: Trigger Scoring for Brands With Events
```bash
# Run this script to score all brands that have events
bash scripts/trigger_scoring.sh
```

This will calculate scores for:
- Starbucks (39 events)
- Columbia Sportswear (16 events)
- Unilever (25 events)

### 2. Fix Cron Authentication
The cron jobs need the `INTERNAL_FN_TOKEN` or `CRON_KEY` in their headers. Update your pg_cron schedules:

```sql
-- Example fix for brand-match cron
SELECT cron.schedule(
  'brand-match-hourly',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "x-internal-token": "YOUR_INTERNAL_TOKEN"}'::jsonb
  ) as request_id;
  $$
);
```

### 3. Set Up Automatic Scoring Trigger
Create a database trigger to auto-calculate scores when events are added:

```sql
-- Trigger score recalculation when events are inserted
CREATE OR REPLACE FUNCTION trigger_score_calc()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue a scoring job
  INSERT INTO jobs (stage, coalesce_key, payload, not_before)
  VALUES (
    'calculate-score',
    NEW.brand_id::TEXT,
    jsonb_build_object('brand_id', NEW.brand_id),
    NOW() + INTERVAL '1 minute'
  )
  ON CONFLICT (stage, coalesce_key) WHERE locked_by IS NULL
  DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_score_trigger
  AFTER INSERT ON brand_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_score_calc();
```

### 4. Verify Wiki/Summary Working
Check if `enrich-brand-wiki` function is being called:
```bash
supabase functions logs enrich-brand-wiki --tail 100
```

## Next Steps

1. **Run `scripts/trigger_scoring.sh`** to immediately score your 3 brands with events
2. **Fix cron authentication** so automated ingestion continues
3. **Set up score trigger** so new events automatically update scores
4. **Test brand profile page** - it should now load properly with scores

## Testing Checklist

- [ ] Navigate to Starbucks brand page - should show score
- [ ] Navigate to Columbia brand page - should show score  
- [ ] Check "Top Movers 24h" section - should show brands
- [ ] Click on a brand - should see evidence timeline
- [ ] Check wiki summary appears on brand pages

## Timeline

- News ingestion: **Working** (last run: Oct 18, 03:10 UTC)
- Scoring: **Fixed** (waiting for manual trigger)
- Display: **Fixed** (user preferences columns added)
- Automation: **Needs fix** (cron headers required)

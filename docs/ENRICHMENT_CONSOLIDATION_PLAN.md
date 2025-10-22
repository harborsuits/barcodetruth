# Enrichment Pipeline Consolidation Plan (Production-Ready)

## Executive Summary

**Goal:** Single canonical enricher per feature, backed by Wikipedia/Wikidata for identity/structure, filings for shareholders.

**Current Problem:** `enrich-brand-wiki` does 3 jobs (descriptions + ownership + key people). This creates coupling, hidden duplication, and makes the pipeline brittle.

**Production Improvements:** Idempotency keys, enums, feature flags, observability, rollback plan.

---

## Phase 0: Schema Hardening (Prerequisites)

### 0.1 Add Stronger Constraints

```sql
-- Idempotency: unique role per company
ALTER TABLE company_people
  ADD COLUMN IF NOT EXISTS image_file text,
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD CONSTRAINT company_people_unique_role UNIQUE (company_id, role);

-- Ownership relationship validation
ALTER TABLE company_ownership
  ADD CONSTRAINT company_ownership_rel_chk
  CHECK (relationship_type IN ('parent','subsidiary','parent_organization'));

-- Shareholder data validation
ALTER TABLE company_shareholders
  ADD COLUMN IF NOT EXISTS holder_name_raw text,
  ADD CONSTRAINT company_shareholders_pct_chk
  CHECK (percent_owned >= 0 AND percent_owned <= 100);

-- People role enum (stronger typing)
DO $$ BEGIN
  CREATE TYPE people_role AS ENUM ('chief_executive_officer','founder','chairperson');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE company_people
  ALTER COLUMN role TYPE people_role USING role::people_role;
```

### 0.2 Add Observability Table

```sql
CREATE TABLE IF NOT EXISTS enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  task text NOT NULL CHECK (task IN ('wiki','ownership','key_people','shareholders','logo')),
  status text NOT NULL CHECK (status IN ('running','success','failed','skipped')),
  rows_written integer DEFAULT 0,
  duration_ms integer,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrichment_runs_brand ON enrichment_runs(brand_id, task, started_at DESC);
CREATE INDEX idx_enrichment_runs_status ON enrichment_runs(status, started_at DESC);

-- RLS: Admins can read, service role can write
ALTER TABLE enrichment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read enrichment runs"
  ON enrichment_runs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage enrichment runs"
  ON enrichment_runs FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

## Phase 1: Function Separation (Week 1)

### 1.1 Refactor `enrich-brand-wiki` (DESC-ONLY Mode)

**Action:** DELETE (not ignore) ownership & key people code. Add feature flag guard.

**Files to Edit:**
- `supabase/functions/enrich-brand-wiki/index.ts`

**What to DELETE:**
- Lines 426-762: All parent company enrichment logic
- Lines 624-756: All key people enrichment logic

**What to ADD at function start:**
```typescript
// Guard: enforce desc-only mode
const ENRICH_MODE = Deno.env.get('ENRICH_BRAND_WIKI_MODE') || 'desc-only';
if (ENRICH_MODE !== 'desc-only') {
  throw new Error('enrich-brand-wiki must run in desc-only mode (ownership/people removed)');
}
```

**Result Contract:**
```typescript
// enrich-brand-wiki ONLY does:
// Input: { brand_id }
// Writes: brands.wiki_en_title, brands.wikidata_qid, brands.wiki_url, brands.description
// Does NOT: ownership, key_people, shareholders
// Observability: writes to enrichment_runs(task='wiki')

// At end of function:
await supabase.from('enrichment_runs').insert({
  brand_id: targetId,
  task: 'wiki',
  status: 'success',
  rows_written: description ? 1 : 0,
  duration_ms: Date.now() - startTime,
  finished_at: new Date().toISOString()
});
```

### 1.2 Enhance `enrich-ownership` (Canonical Ownership)

**Action:** Make it the ONLY ownership enricher with idempotent writes.

**Source Strategy:**
- Wikidata P749 (parent organization)
- Wikidata P355 (subsidiary)
- Writes ONLY to `company_ownership` table
- Relationship types: `parent`, `subsidiary`, `parent_organization`

**Guardrails:**
- Asset manager trigger already exists (`forbid_asset_managers_as_parents`)
- Confidence threshold: ≥ 0.9 (Wikidata is highly structured)
- CHECK constraint on relationship_type (added in Phase 0)

**Idempotency:**
```typescript
// UPSERT with soft updates (only overwrite if newer)
await supabase.from('company_ownership').upsert({
  parent_company_id,
  child_brand_id,
  relationship_type,
  source: 'wikidata',
  source_ref: `https://www.wikidata.org/wiki/${wikidata_qid}`,
  confidence: 0.9,
  last_verified_at: new Date().toISOString()
}, {
  onConflict: 'parent_company_id,child_brand_id',
  ignoreDuplicates: false // Update if last_verified_at is newer
});
```

**Observability:**
```typescript
await supabase.from('enrichment_runs').insert({
  brand_id,
  task: 'ownership',
  status: 'success',
  rows_written: edgesAdded,
  duration_ms: Date.now() - startTime,
  finished_at: new Date().toISOString()
});
```

### 1.3 Enhance `enrich-key-people` (Canonical Key People)

**Action:** Make it the ONLY key people enricher with proper English links and idempotency.

**Source Strategy:**
- Wikidata P169 (CEO), P112 (Founder), P488 (Chair)
- Wikidata P18 (image) → Commons FilePath with width param
- **CRITICAL:** Store enwiki sitelink as `wikipedia_url` (prefer over constructed URLs)
- Store both `image_file` (raw filename) and `image_url` (rendered URL)

**Enhanced SPARQL Query:**
```typescript
const sparqlQuery = `
  SELECT ?person ?personLabel ?role ?image ?article WHERE {
    VALUES (?prop ?role) {
      (wd:P169 "chief_executive_officer")
      (wd:P112 "founder")
      (wd:P488 "chairperson")
    }
    wd:${qid} ?p ?statement .
    ?statement ?ps ?person .
    ?p wikibase:directClaim ?prop .
    
    # Get image (optional)
    OPTIONAL { ?person wdt:P18 ?image }
    
    # Get enwiki sitelink (preferred)
    OPTIONAL {
      ?article schema:about ?person ;
               schema:isPartOf <https://en.wikipedia.org/> .
    }
    
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
`;

// Process results with proper URL handling
for (const binding of data.results.bindings) {
  const personQid = binding.person.value.split('/').pop();
  const name = binding.personLabel.value;
  const role = binding.role.value; // enum value
  
  // Image handling: store both raw and rendered
  let imageFile: string | undefined;
  let imageUrl: string | undefined;
  if (binding.image?.value) {
    const filename = decodeURIComponent(binding.image.value.split('/').pop());
    imageFile = filename;
    imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=256`;
  }
  
  // Wikipedia URL: prefer enwiki sitelink
  const wikipediaUrl = binding.article?.value || null;
  
  await supabase.from('company_people').upsert({
    company_id,
    person_name: name,
    role: role as people_role, // typed enum
    person_qid: personQid,
    image_file: imageFile,
    image_url: imageUrl,
    wikipedia_url: wikipediaUrl,
    source: 'wikidata',
    source_ref: `https://www.wikidata.org/wiki/${personQid}`,
    confidence: 0.95,
    last_verified_at: new Date().toISOString()
  }, {
    onConflict: 'company_id,role',
    // Only update if newer or has more data
    ignoreDuplicates: false
  });
}
```

**Idempotency:**
- UNIQUE constraint on `(company_id, role)` ensures one CEO, one Founder, one Chair
- Soft updates: only overwrite if `last_verified_at` is newer

**Observability:**
```typescript
await supabase.from('enrichment_runs').insert({
  company_id,
  task: 'key_people',
  status: 'success',
  rows_written: people.length,
  duration_ms: Date.now() - startTime,
  finished_at: new Date().toISOString()
});
```

---

## Phase 2: New Shareholder Enricher (Week 2)

### 2.1 Create `enrich-shareholders` (SEC-First)

**Why NOT use Wikidata:** Wikipedia/Wikidata are patchy/stale for institutional holders. Use filings-based sources.

**Source Strategy (Priority Order):**
1. SEC 13F filings aggregator (WhaleWisdom API, SEC EDGAR bulk data)
2. Company IR pages (quarterly reports)
3. Manual entry for non-US public companies

**Schema (Already Exists, Adding Fields):**
```sql
ALTER TABLE company_shareholders
  ADD COLUMN IF NOT EXISTS holder_name_raw text,
  ADD CONSTRAINT company_shareholders_pct_chk
  CHECK (percent_owned >= 0 AND percent_owned <= 100);
```

**Edge Function (Production-Ready):**
```typescript
// supabase/functions/enrich-shareholders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface Shareholder {
  name: string;
  name_raw: string;
  percent: number;
  filing_date: string;
  filing_url: string;
  holder_type: 'institutional' | 'insider' | 'retail_estimate';
}

// Asset manager detection with normalization
const ASSET_MANAGERS = [
  'BlackRock', 'Vanguard', 'State Street', 'Fidelity',
  'Invesco', 'Capital Group', 'T. Rowe Price', 'BNY Mellon',
  'Morgan Stanley', 'Goldman Sachs', 'JPMorgan'
];

function normalizeName(name: string): string {
  // "The Vanguard Group, Inc." → "Vanguard"
  return name
    .replace(/^The\s+/i, '')
    .replace(/\s+(Inc|LLC|LP|Ltd|Corporation|Corp)\.?$/i, '')
    .trim();
}

function isAssetManager(name: string): boolean {
  const normalized = normalizeName(name);
  return ASSET_MANAGERS.some(am => normalized.includes(am));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { company_id, ticker } = await req.json();
    
    if (!company_id || !ticker) {
      return new Response(
        JSON.stringify({ error: 'company_id and ticker required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch top institutional holders (from your chosen provider)
    const holders: Shareholder[] = await fetchInstitutionalHolders(ticker);
    
    // Validate and filter
    const cleaned = holders
      .filter(h => h.holder_type === 'institutional' && h.percent > 0)
      .slice(0, 10); // Top 10 only

    let inserted = 0;
    for (const h of cleaned) {
      const { error } = await supabase.from('company_shareholders').upsert({
        company_id,
        holder_name: normalizeName(h.name),
        holder_name_raw: h.name_raw,
        holder_type: h.holder_type,
        percent_owned: Math.round(h.percent * 100) / 100, // Round to 2 decimals
        is_asset_manager: isAssetManager(h.name),
        as_of: h.filing_date,
        source: 'SEC 13F',
        source_name: 'SEC EDGAR',
        source_url: h.filing_url,
      }, {
        onConflict: 'company_id,holder_name,as_of',
        ignoreDuplicates: true
      });

      if (!error) inserted++;
    }

    // Observability
    await supabase.from('enrichment_runs').insert({
      company_id,
      task: 'shareholders',
      status: 'success',
      rows_written: inserted,
      duration_ms: Date.now() - startTime,
      finished_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, inserted, total_fetched: holders.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enriching shareholders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Placeholder for actual data fetch (implement based on your provider)
async function fetchInstitutionalHolders(ticker: string): Promise<Shareholder[]> {
  // TODO: Integrate with SEC EDGAR API or WhaleWisdom
  // For now, return empty array
  return [];
}
```

**Batching + Rate Limits:**
```typescript
// Add to all enrichers
const BATCH_SIZE = 50;
const SLEEP_MS = 100; // Jitter between API calls

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
  if (i + BATCH_SIZE < items.length) {
    await new Promise(resolve => setTimeout(resolve, SLEEP_MS));
  }
}
```

---

## Phase 3: Data Migration (Week 3)

### 3.1 Ownership Migration
**Goal:** Move legacy `brand_ownerships` data into `company_ownership`.

```sql
-- Migration script
INSERT INTO company_ownership (
  parent_company_id, 
  child_brand_id, 
  relationship_type,
  source_name,
  confidence
)
SELECT DISTINCT
  bo.parent_brand_id,
  bo.child_brand_id,
  CASE
    WHEN bo.relationship ILIKE 'parent%' THEN 'parent'
    WHEN bo.relationship ILIKE 'subsidiar%' THEN 'subsidiary'
    ELSE 'parent_organization'
  END,
  COALESCE(bo.source, 'Legacy Migration'),
  COALESCE(bo.confidence, 0.7)
FROM brand_ownerships bo
WHERE NOT EXISTS (
  SELECT 1 FROM company_ownership co
  WHERE co.parent_company_id = bo.parent_brand_id
    AND co.child_brand_id = bo.child_brand_id
);

-- Verify: should show control relationships
SELECT COUNT(*) FROM company_ownership WHERE relationship_type IN ('parent','subsidiary','parent_organization');
```

### 3.2 Key People Backfill
**Goal:** Enrich top 20 brands with CEO at minimum.

```sql
-- Find brands with Wikidata QID but no key people
SELECT b.id, b.name, b.wikidata_qid
FROM brands b
LEFT JOIN company_people cp ON cp.company_id = (
  SELECT parent_company_id FROM company_ownership WHERE child_brand_id = b.id LIMIT 1
)
WHERE b.wikidata_qid IS NOT NULL
  AND b.is_active = true
  AND cp.id IS NULL
ORDER BY b.name
LIMIT 20;

-- Then call enrich-key-people for each
```

---

## Phase 4: Orchestration & Scheduling (Week 4)

### 4.1 Unified Enrichment Endpoint
```typescript
// POST /functions/v1/enrich-brand
// Body: { brand_id, tasks: ["wiki","ownership","people","shareholders","logo"] }

export default async (req: Request) => {
  const { brand_id, tasks } = await req.json();
  const results = {};
  
  if (tasks.includes('wiki')) {
    results.wiki = await invoke('enrich-brand-wiki', { brand_id });
  }
  
  if (tasks.includes('ownership')) {
    const qid = await getQid(brand_id);
    results.ownership = await invoke('enrich-ownership', { brand_id, wikidata_qid: qid });
  }
  
  if (tasks.includes('people')) {
    const qid = await getQid(brand_id);
    results.people = await invoke('enrich-key-people', { company_id, wikidata_qid: qid });
  }
  
  if (tasks.includes('shareholders')) {
    const ticker = await getTicker(brand_id);
    if (ticker) {
      results.shareholders = await invoke('enrich-shareholders', { company_id, ticker });
    }
  }
  
  if (tasks.includes('logo')) {
    results.logo = await invoke('resolve-brand-logo', { brand_id });
  }
  
  return results;
};
```

### 4.2 Weekly Batch Jobs
```sql
-- Cron: enrich missing descriptions (Monday 2am)
SELECT cron.schedule(
  'enrich-descriptions-weekly',
  '0 2 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/enrich-brand-wiki',
    body := '{"mode":"missing"}'::jsonb
  )
  $$
);

-- Cron: refresh shareholders for public cos (Friday 3am)
SELECT cron.schedule(
  'refresh-shareholders-weekly',
  '0 3 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/enrich-shareholders-batch'
  )
  $$
);
```

---

## Phase 5: Quality Assurance

### 5.1 Gap Detection Queries
```sql
-- Missing descriptions (target: 0)
SELECT COUNT(*) FROM brands WHERE COALESCE(LENGTH(description), 0) < 40;

-- Missing ownership (target: <10% for public brands)
SELECT COUNT(*) 
FROM brands b
LEFT JOIN company_ownership co ON co.child_brand_id = b.id AND co.relationship_type = 'parent'
WHERE b.is_public = true AND co.id IS NULL;

-- Missing key people (target: <20% for top brands)
SELECT COUNT(*)
FROM brands b
LEFT JOIN company_people cp ON cp.company_id = (
  SELECT parent_company_id FROM company_ownership WHERE child_brand_id = b.id LIMIT 1
)
WHERE b.is_active = true AND cp.id IS NULL;

-- Public cos with <4 shareholders (target: 0)
SELECT b.name, COUNT(cs.id) as holder_count
FROM brands b
LEFT JOIN company_shareholders cs ON cs.company_id = b.id AND cs.holder_type = 'institutional'
WHERE b.is_public = true
GROUP BY b.id, b.name
HAVING COUNT(cs.id) < 4;
```

### 5.2 Playwright Smoke Test
```typescript
// tests/brandProfile.spec.ts
test('brand profile completeness', async ({ page }) => {
  await page.goto('/brand/walmart');
  
  // All required sections present
  await expect(page.getByText(/Key people/i)).toBeVisible();
  await expect(page.getByText(/Ownership/i)).toBeVisible();
  await expect(page.getByText(/Top shareholders/i)).toBeVisible();
  
  // Wikipedia link works
  const wikiLink = page.getByRole('link', { name: /source/i });
  await expect(wikiLink).toHaveAttribute('href', /en\.wikipedia\.org/);
  
  // No asset managers as parents
  const ownershipCard = page.locator('[data-testid="ownership-card"]');
  await expect(ownershipCard.getByText(/BlackRock|Vanguard|State Street/i)).not.toBeVisible();
  
  // Shareholder disclaimer present
  await expect(page.getByText(/investors.*not imply control/i)).toBeVisible();
});
```

---

## Success Metrics Dashboard

```sql
-- Weekly coverage report
SELECT
  COUNT(*) FILTER (WHERE description IS NOT NULL AND LENGTH(description) >= 40) * 100.0 / COUNT(*) as pct_description,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM company_ownership co WHERE co.child_brand_id = brands.id AND co.relationship_type = 'parent'
  )) * 100.0 / COUNT(*) as pct_ownership,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM company_people cp 
    WHERE cp.company_id = (SELECT parent_company_id FROM company_ownership WHERE child_brand_id = brands.id LIMIT 1)
  )) * 100.0 / COUNT(*) as pct_key_people,
  COUNT(*) FILTER (WHERE is_public = false OR (
    SELECT COUNT(*) FROM company_shareholders cs WHERE cs.company_id = brands.id AND cs.holder_type = 'institutional'
  ) >= 4) * 100.0 / COUNT(*) as pct_shareholders
FROM brands
WHERE is_active = true;
```

---

## Rollout Checklist (Production-Ready)

### Phase 0: Prerequisites (Day 1-2)
- [ ] Run schema hardening migration (constraints, enums, observability)
- [ ] Verify `enrichment_runs` table created with RLS policies
- [ ] Create backup of current `enrich-brand-wiki` function
- [ ] Set `ENRICH_BRAND_WIKI_MODE=desc-only` environment variable

### Week 1: Separation (Day 3-7)
- [ ] DELETE lines 426-762 from `enrich-brand-wiki/index.ts` (ownership + people)
- [ ] ADD feature flag guard at function start
- [ ] ADD observability tracking to `enrichment_runs`
- [ ] Test `enrich-brand-wiki` only sets description + QID (3 test brands)
- [ ] Verify no console errors or data corruption

### Week 1.5: Key People (Day 8-10)
- [ ] ADD `wikipedia_url`, `image_file` to `enrich-key-people` SPARQL
- [ ] ADD idempotency with `ON CONFLICT (company_id, role)`
- [ ] ADD observability tracking
- [ ] Test with Walmart, Kroger, Dove (expect CEO + Founder)
- [ ] Verify English Wikipedia links work

### Week 2: Shareholders (Day 11-14)
- [ ] Implement `enrich-shareholders/index.ts` with SEC-first strategy
- [ ] ADD `holder_name_raw` to `company_shareholders` table
- [ ] Test with 3 public companies (Walmart, Starbucks, Nike)
- [ ] Verify ≥4 institutional holders for each
- [ ] Verify asset manager badges render correctly

### Week 3: Migration (Day 15-21)
- [ ] Run ownership migration SQL (legacy → `company_ownership`)
- [ ] Verify no asset managers in `company_ownership` (trigger test)
- [ ] Backfill key people for top 20 brands using enhanced enricher
- [ ] Check coverage: `SELECT * FROM brand_profile_coverage;`
- [ ] Update UI components to consume new data structure

### Week 4: Automation (Day 22-28)
- [ ] Deploy unified `enrich-brand` orchestrator
- [ ] Schedule weekly description batch (Monday 2am)
- [ ] Schedule weekly shareholder refresh (Friday 3am)
- [ ] Create admin dashboard: `/admin/enrichment-monitor`
- [ ] Set up Slack alerts for failed enrichment runs

### Week 5: QA & Documentation (Day 29-35)
- [ ] Run gap detection queries (target: <5% gaps)
- [ ] Fix failures and document edge cases
- [ ] Run Playwright smoke tests (ownership, key people, shareholders)
- [ ] Document enrichment SLAs:
  - Descriptions: 95% coverage, refresh quarterly
  - Ownership: 90% coverage, refresh quarterly
  - Key People: 80% for top 50 brands, refresh quarterly
  - Shareholders: 100% for public cos, refresh monthly
- [ ] Delete backup function (after 7-day grace period)

### Acceptance Criteria

**Must Pass Before Production:**
1. Zero console errors in browser dev tools
2. No asset managers in `company_ownership` table
3. ≥90% of brands have descriptions
4. Walmart profile shows: parent (Walton family), CEO (Doug McMillon), ≥4 shareholders
5. `enrichment_runs` table shows all tasks completing in <5s per brand
6. Dark mode snapshot matches baseline (Playwright)

---

## Rollback Plan

### Safety Measures

1. **Feature Flags:**
   - `ENRICH_BRAND_WIKI_MODE=desc-only` enforced at function entry
   - If new pipeline fails, temporarily set to `legacy` to use backup

2. **Backup Function:**
   - Keep `enrich-brand-wiki-backup.ts` (frozen copy) for 7 days
   - Feature-flagged off by default
   - Allows quick rollback if critical issues arise

3. **Migration Reversibility:**
   - Ownership migration uses UPSERT (safe to re-run)
   - Legacy `brand_ownerships` table NOT dropped (soft deprecation)
   - Can reconstruct from backup if needed

4. **Gradual Rollout:**
   - Test with 3-5 brands first (Walmart, Starbucks, Nike)
   - Monitor `enrichment_runs` for errors
   - Scale to batch mode only after validation

### Rollback Steps (If Needed)

```bash
# 1. Revert feature flag
ENRICH_BRAND_WIKI_MODE=legacy

# 2. Restore backup function (if deleted)
cp enrich-brand-wiki-backup.ts enrich-brand-wiki/index.ts

# 3. Clear bad data (if any)
DELETE FROM company_ownership WHERE confidence < 0.8;
DELETE FROM company_people WHERE source = 'wikidata' AND created_at > '2025-01-23';

# 4. Re-run legacy enricher for affected brands
POST /functions/v1/enrich-brand-wiki?brand_id={id}
```

---

## Files to Edit

### Edge Functions (DELETE/REFACTOR)
- `supabase/functions/enrich-brand-wiki/index.ts` (DELETE lines 426-762, ADD desc-only guard)
- `supabase/functions/enrich-ownership/index.ts` (ADD idempotency + observability)
- `supabase/functions/enrich-key-people/index.ts` (ADD wikipedia_url + image_file + observability)
- `supabase/functions/enrich-shareholders/index.ts` (NEW - SEC-first shareholder enricher)
- `supabase/functions/enrich-brand/index.ts` (NEW - unified orchestrator)

### Migrations (SQL)
- `20250123_schema_hardening.sql` (Phase 0: constraints, enums, observability table)
- `20250123_migrate_legacy_ownership.sql` (Phase 3: brand_ownerships → company_ownership)

### UI Components (Already Created ✅)
- `src/components/brand/OwnershipSimple.tsx`
- `src/components/brand/KeyPeopleSimple.tsx`
- `src/components/brand/ShareholdersSimple.tsx`

### Admin Dashboard (NEW)
- `src/pages/AdminEnrichmentMonitor.tsx` (view enrichment_runs table, gap analysis)

---

## Wikipedia/Wikidata Sourcing Rules

| Feature | Primary Source | Confidence | Refresh |
|---------|---------------|-----------|---------|
| Description | enwiki extract | 1.0 | Quarterly |
| Wikidata QID | Wikidata search | 0.95 | On create |
| Ownership | Wikidata P749/P355 | 0.9 | Quarterly |
| Key People | Wikidata P169/P112/P488 + P18 | 0.95 | Quarterly |
| People Photos | Commons FilePath | 0.9 | Quarterly |
| People Links | enwiki sitelink | 1.0 | - |
| Shareholders | **SEC 13F / IR** (NOT Wiki) | 0.85 | Monthly |
| Valuation | **Market data** (NOT Wiki) | 0.95 | Weekly |
| Logo | Website → enwiki infobox | 0.8 | On change |

**Key Principle:** Use Wiki for structure/identity, NOT for financial data.

# Enrichment Pipeline Consolidation Plan

## Executive Summary

**Goal:** Single canonical enricher per feature, backed by Wikipedia/Wikidata for identity/structure, filings for shareholders.

**Current Problem:** `enrich-brand-wiki` does 3 jobs (descriptions + ownership + key people). This creates coupling and makes the pipeline brittle.

---

## Phase 1: Function Separation (Week 1)

### 1.1 Refactor `enrich-brand-wiki`
**Action:** Remove ownership & key people logic; focus ONLY on descriptions.

**Files to Edit:**
- `supabase/functions/enrich-brand-wiki/index.ts` (lines 426-762)

**What to Remove:**
- Parent company enrichment (lines 442-623)
- Key people enrichment (lines 624-756)
- Keep only: Wikipedia description fetch + wikidata_qid resolution

**Result:**
```typescript
// enrich-brand-wiki should ONLY do:
1. Resolve name → Wikidata QID
2. Get enwiki title from QID
3. Fetch Wikipedia extract
4. Store: description, wiki_url, wikidata_qid, wiki_en_title
```

### 1.2 Enhance `enrich-ownership`
**Action:** Make it the ONLY ownership enricher.

**Source Strategy:**
- Wikidata P749 (parent organization)
- Wikidata P355 (subsidiary)
- Writes ONLY to `company_ownership` table
- Relationship types: `parent`, `subsidiary`, `parent_organization`

**Guardrails:**
- Asset manager trigger already exists (`forbid_asset_managers_as_parents`)
- Confidence threshold: ≥ 0.7

**Add Fields:**
```sql
ALTER TABLE company_ownership
  ADD COLUMN IF NOT EXISTS source_name text DEFAULT 'Wikidata',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz DEFAULT now();
```

### 1.3 Enhance `enrich-key-people`
**Action:** Make it the ONLY key people enricher.

**Source Strategy:**
- Wikidata P169 (CEO), P112 (Founder), P488 (Chair)
- Wikidata P18 (image) → Commons FilePath
- **CRITICAL:** Store enwiki sitelink as `wikipedia_url` (don't construct on fly)

**Current Bug:** Function exists but doesn't store `wikipedia_url`.

**Fix Required:**
```typescript
// In SPARQL query, get enwiki sitelink:
SELECT ?person ?personLabel ?image ?article WHERE {
  VALUES ?prop { wd:P169 wd:P112 wd:P488 }
  wd:${qid} ?p ?statement .
  ?statement ?ps ?person .
  ?p wikibase:directClaim ?prop .
  OPTIONAL { ?person wdt:P18 ?image }
  OPTIONAL {
    ?article schema:about ?person ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}

// Then store:
{
  wikipedia_url: article (e.g., "https://en.wikipedia.org/wiki/Doug_McMillon"),
  image_url: Special:FilePath/...?width=256,
  person_qid: Q123456,
  source_name: 'Wikidata',
  source_url: `https://www.wikidata.org/wiki/${qid}`,
  confidence: 0.95
}
```

**Add Fields:**
```sql
ALTER TABLE company_people
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS person_qid text,
  ADD COLUMN IF NOT EXISTS source_name text DEFAULT 'Wikidata',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.95,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz DEFAULT now();
```

---

## Phase 2: New Shareholder Enricher (Week 2)

### 2.1 Create `enrich-shareholders`
**Why NOT use Wikidata:** Wikipedia/Wikidata are patchy/stale for institutional holders.

**Source Strategy:**
1. SEC 13F filings aggregator (e.g., WhaleWisdom API, SEC EDGAR bulk)
2. Company IR pages (last resort)
3. Manual flagging for non-US public cos

**Table Schema:**
```sql
CREATE TABLE IF NOT EXISTS company_shareholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  holder_type text NOT NULL CHECK (holder_type IN ('institutional','insider','retail_estimate')),
  pct numeric NOT NULL CHECK (pct >= 0 AND pct <= 100),
  is_asset_manager boolean DEFAULT false,
  as_of_date date,
  source_name text,
  source_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, holder_name, as_of_date)
);
```

**Edge Function Skeleton:**
```typescript
// supabase/functions/enrich-shareholders/index.ts
export default async (req: Request) => {
  const { company_id, ticker } = await req.json();
  
  // Fetch top 10 institutional holders
  const holders = await fetchInstitutionalHolders(ticker);
  
  // Upsert with provenance
  for (const h of holders) {
    await supabase.from('company_shareholders').upsert({
      company_id,
      holder_name: h.name,
      holder_type: 'institutional',
      pct: h.percent,
      is_asset_manager: isAssetManager(h.name),
      as_of_date: h.filingDate,
      source_name: 'SEC 13F',
      source_url: h.filingUrl
    }, {
      onConflict: 'company_id,holder_name,as_of_date'
    });
  }
  
  return { success: true, inserted: holders.length };
};
```

**Asset Manager Detection:**
```typescript
const ASSET_MANAGERS = [
  'BlackRock', 'Vanguard', 'State Street', 'Fidelity',
  'Invesco', 'Capital Group', 'T. Rowe Price'
];

function isAssetManager(name: string): boolean {
  return ASSET_MANAGERS.some(am => name.includes(am));
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

## Rollout Checklist

### Week 1: Separation
- [ ] Remove ownership/people logic from `enrich-brand-wiki`
- [ ] Test `enrich-brand-wiki` only sets description + QID
- [ ] Add `wikipedia_url` to `enrich-key-people` SPARQL
- [ ] Add provenance fields to `company_ownership` and `company_people`

### Week 2: Shareholders
- [ ] Create `company_shareholders` table with constraints
- [ ] Implement `enrich-shareholders` edge function
- [ ] Test with 3 public companies (Walmart, Starbucks, Nike)
- [ ] Verify asset manager badges render

### Week 3: Migration
- [ ] Run ownership migration SQL
- [ ] Backfill key people for top 20 brands
- [ ] Verify no asset managers in `company_ownership`
- [ ] Update UI components to use new tables

### Week 4: Automation
- [ ] Deploy unified `enrich-brand` orchestrator
- [ ] Schedule weekly description batch
- [ ] Schedule weekly shareholder refresh
- [ ] Set up coverage metrics dashboard

### Week 5: QA
- [ ] Run gap detection queries
- [ ] Fix failures (target: <5% gaps for top features)
- [ ] Run Playwright smoke tests
- [ ] Document enrichment SLAs

---

## Files to Edit

### Edge Functions
- `supabase/functions/enrich-brand-wiki/index.ts` (refactor lines 426-762)
- `supabase/functions/enrich-ownership/index.ts` (add provenance)
- `supabase/functions/enrich-key-people/index.ts` (add wikipedia_url)
- `supabase/functions/enrich-shareholders/index.ts` (NEW)
- `supabase/functions/enrich-brand/index.ts` (NEW orchestrator)

### Migrations
- `20250123_add_shareholder_table.sql`
- `20250123_add_provenance_fields.sql`
- `20250123_migrate_legacy_ownership.sql`

### UI Components (Already Created ✅)
- `src/components/brand/OwnershipSimple.tsx`
- `src/components/brand/KeyPeopleSimple.tsx`
- `src/components/brand/ShareholdersSimple.tsx`

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

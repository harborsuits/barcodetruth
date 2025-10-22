# Brand Consistency Action Plan

## Current Status (As of Check)

### Data Completeness Audit
- **Total Active Brands**: 76
- **Missing Descriptions**: 6 (8%)
- **Missing Parent Company**: 1 (1%)
- **Has Key People**: 2 brands only (3%)
- **Has Shareholders**: Unknown (needs check)

### Reference Standard
✅ **Walmart** - Complete profile with all features

---

## Priority 1: Critical Data Gaps (Immediate)

### 1.1 Fill Missing Descriptions (6 brands)
```sql
-- Run enrichment for brands without descriptions
-- This auto-triggers via BrandWikiEnrichment component OR:
SELECT id, name FROM brands 
WHERE is_active = true 
  AND is_test = false
  AND (description IS NULL OR description = '');
```

**Action**: Call enrichment function for each:
```bash
curl -X GET "https://[project].supabase.co/functions/v1/enrich-brand-wiki?brand_id=[id]&mode=missing"
```

### 1.2 Add Key People (74 brands missing!)
This is the **biggest gap**. Only 2 brands have key people data.

**Manual Process** (for top brands):
1. Find company in Wikidata
2. Look up CEO (P169), Founder (P112), Chairperson (P488)
3. Get person name, QID, and photo
4. Insert via SQL:

```sql
INSERT INTO company_people (
  company_id,
  role,
  person_name,
  person_qid,
  image_url,
  source,
  source_ref,
  confidence
) VALUES (
  '[company_id]',
  'chief_executive_officer',
  '[CEO Name]',
  'Q[wikidata_id]',
  'https://upload.wikimedia.org/...',
  'wikidata',
  'https://www.wikidata.org/wiki/Q[id]',
  0.95
);
```

**Automated Process** (recommended):
Update `enrich-brand-wiki` function to fetch key people from Wikidata automatically.

### 1.3 Add Shareholders for Public Companies
Need to identify which of the 76 brands are public companies and add top 10 shareholders.

**Query public companies**:
```sql
SELECT b.id, b.name, c.ticker, c.exchange
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
JOIN companies c ON c.id = co.parent_company_id
WHERE c.is_public = true;
```

**For each public company**, add shareholders via:
```sql
INSERT INTO company_shareholders (
  company_id,
  holder_name,
  holder_type,
  percent_owned,
  source,
  as_of
) VALUES (...);
```

---

## Priority 2: Data Quality Issues (This Week)

### 2.1 Fix Wikipedia Links
All key people currently link to Wikidata entity pages. Need to link to English Wikipedia instead.

**Status**: ✅ FIXED in KeyPeopleRow.tsx
```tsx
href={`https://en.wikipedia.org/wiki/${encodeURIComponent(person.name.replace(/ /g, '_'))}`}
```

### 2.2 Verify Control vs Shareholder Relationships
Ensure no asset managers are in `company_ownership` table.

```sql
-- Audit: Check for asset managers in control relationships
SELECT co.*, c.name
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
WHERE c.name ILIKE ANY(ARRAY[
  '%Vanguard%',
  '%BlackRock%',
  '%State Street%',
  '%Fidelity%',
  '%Capital%'
]);
```

**If found**: Move to `company_shareholders` and remove from `company_ownership`.

### 2.3 Add Missing Logos
6 brands missing descriptions likely also missing logos.

**Action**: Call logo resolver:
```bash
curl -X POST "https://[project].supabase.co/functions/v1/resolve-brand-logo" \
  -H "Content-Type: application/json" \
  -d '{"brand_id": "[id]"}'
```

---

## Priority 3: Feature Parity (This Month)

### 3.1 Valuation Data for Public Companies
Add market cap for all public companies.

**Required fields**:
- company_id
- metric ('market_cap')
- value_numeric
- currency ('USD')
- as_of_date
- source

### 3.2 Corporate Structure Data
Map parent-subsidiary relationships for all brands.

**Query missing structure**:
```sql
SELECT b.id, b.name
FROM brands b
WHERE b.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM company_ownership co
    WHERE co.child_brand_id = b.id
  );
```

### 3.3 Sister Brands
Identify sibling brands for all companies with parents.

**This is automatic** via the ownership structure query, but requires:
1. Parent company must be in `companies` table
2. All sibling brands linked to same parent
3. Relationship type = 'subsidiary' or 'parent'

---

## Priority 4: Automation (Ongoing)

### 4.1 Enhanced Enrichment Pipeline
Update `enrich-brand-wiki` to fetch ALL of:
- ✅ Description
- ✅ Parent company
- ⚠️ Key people (needs enhancement)
- ⚠️ Company logo (needs enhancement)
- ❌ Shareholders (manual for now)
- ❌ Valuation (manual for now)

### 4.2 Scheduled Enrichment
Set up cron job to:
```sql
-- Weekly: Enrich brands missing any data
SELECT id FROM brands
WHERE is_active = true
  AND (
    description IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM company_ownership 
      WHERE child_brand_id = brands.id
    )
  );
```

### 4.3 Data Quality Monitoring
Create dashboard query:
```sql
SELECT 
  COUNT(*) FILTER (WHERE description IS NOT NULL) as has_description,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM company_ownership WHERE child_brand_id = brands.id
  )) as has_parent,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM company_ownership co
    JOIN company_people cp ON cp.company_id = co.parent_company_id
    WHERE co.child_brand_id = brands.id
  )) as has_people,
  COUNT(*) FILTER (WHERE logo_url IS NOT NULL) as has_logo,
  COUNT(*) as total
FROM brands
WHERE is_active = true AND is_test = false;
```

---

## Implementation Timeline

### Week 1 (Immediate)
- [ ] Run enrichment for 6 brands missing descriptions
- [ ] Add key people for top 10 brands manually
- [ ] Verify Wikipedia link fix is deployed
- [ ] Audit shareholder vs control relationships

### Week 2
- [ ] Add shareholders for all public companies (top 20 brands)
- [ ] Add valuations for public companies
- [ ] Fix any asset managers in wrong table
- [ ] Add missing logos

### Week 3
- [ ] Add key people for remaining 60+ brands
- [ ] Map all corporate structures
- [ ] Verify sister brands display correctly
- [ ] Test 20 random brand profiles

### Week 4 (Ongoing)
- [ ] Set up automated enrichment cron
- [ ] Create data quality dashboard
- [ ] Document all manual processes
- [ ] Create enrichment runbook

---

## Success Criteria

By end of month, ALL 76 active brands should have:
- ✅ Description (Wikipedia)
- ✅ Logo or monogram fallback
- ✅ Parent company (if applicable)
- ✅ Key people (CEO at minimum)
- ✅ Shareholders (if public company)
- ✅ Valuation (if public company)
- ✅ All 4 category scores showing
- ✅ Proper data collection status
- ✅ Working external links

**Quality Check**: Random sample of 10 brands passes full testing checklist from CONSISTENCY_IMPLEMENTATION_GUIDE.md

---

## Maintenance Plan

### Daily
- Monitor enrichment errors
- Check for new brands needing enrichment

### Weekly
- Run data completeness audit
- Enrich any brands missing data
- Update shareholder percentages

### Monthly
- Full quality audit of all brands
- Update Wikidata references
- Refresh market cap values
- Review and update key people

### Quarterly
- Comprehensive data refresh
- Audit all external links
- Update this action plan
- Review enrichment automation

---

## Tools & Resources

### SQL Queries
See `docs/BRAND_PROFILE_STANDARD.md` for all validation queries

### Edge Functions
- `enrich-brand-wiki` - Auto-enriches from Wikipedia/Wikidata
- `resolve-brand-logo` - Fetches brand logos
- `get-brand-ownership` - Returns ownership structure
- `get-brand-company-info` - Returns company details

### Manual Data Entry
When automated enrichment fails, use direct SQL:
```sql
-- Template in docs/CONSISTENCY_IMPLEMENTATION_GUIDE.md
```

### Monitoring Dashboard
```sql
-- Run weekly to track progress
-- Query in Priority 4.3 above
```

---

## Contact & Support

For questions about:
- **Enrichment pipeline**: Check `supabase/functions/enrich-brand-wiki/`
- **Data quality**: Run audit queries in this document
- **UI issues**: See `src/pages/BrandProfile.tsx`
- **Component bugs**: Check individual component files in `src/components/brand/`

**Document Version**: 1.0 (Updated after Walmart reference implementation)

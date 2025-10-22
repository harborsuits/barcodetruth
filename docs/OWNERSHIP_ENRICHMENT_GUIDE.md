# Parent Company & Key People Enrichment Guide

## Overview

The `enrich-brand-wiki` function automatically extracts parent company relationships and key people (CEO, Chairperson, Founders) from Wikidata when enriching a brand.

## What Gets Enriched

### 1. Parent Company (P749 - parent organization)
- Creates `company_ownership` record linking brand to parent
- Creates `companies` entry for parent if it doesn't exist
- Fetches Wikipedia description for parent company
- Extracts country information (P17)
- Determines public/private status (P414 - stock exchange)
- Extracts ticker symbol (P249 or P414 qualifier)

### 2. Key People
Extracts up to 2 people per role:
- **CEO** (P169 - chief executive officer)
- **Chairperson** (P488 - chairperson)
- **Founders** (P112 - founder)

For each person:
- Name from Wikidata labels
- Role (stored as snake_case: `chief_executive_officer`, `chairperson`, `founder`)
- Profile image (P18) if available
- Wikidata QID for linking
- Source reference URL

### 3. SEC Ticker Integration
If parent company is public and has a ticker:
- Automatically adds `brand_data_mappings` entry
- Enables SEC EDGAR feed for the brand
- Links future SEC filings to brand events

## Data Flow

```
Brand (with wikidata_qid)
  ↓
enrich-brand-wiki function
  ↓
Fetches from Wikidata API
  ↓
Creates/Updates:
  - companies (parent company with Wikipedia data)
  - company_ownership (brand → parent relationship)
  - company_people (executives and founders)
  - brand_data_mappings (SEC ticker if public)
```

## UI Display

### OwnershipCard Component
Shows parent company with:
- Company logo (if available)
- Name and relationship type
- Public/private status with ticker
- Country
- Wikipedia description
- Link to Wikidata
- Confidence score and source

### KeyPeopleRow Component
Shows key people with:
- Profile images (avatars)
- Names and roles (CEO, Chair, Founders)
- Clickable links to Wikidata profiles
- Source attribution
- Grouped display (executives separate from founders)

## Testing Enrichment

### Manual Test
```bash
# Test with a brand that has Wikidata ID
curl -X POST "$SUPABASE_URL/functions/v1/enrich-brand-wiki?brand_id=YOUR_BRAND_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

### Check Results
```sql
-- Verify parent company was created
SELECT 
  b.name as brand_name,
  co.parent_name,
  co.confidence,
  c.name as parent_company_name,
  c.description,
  c.country,
  c.is_public,
  c.ticker
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN companies c ON c.id = co.parent_company_id
WHERE b.id = 'YOUR_BRAND_ID';

-- Verify key people were added
SELECT 
  c.name as company_name,
  cp.role,
  cp.person_name,
  cp.person_qid,
  cp.image_url IS NOT NULL as has_image
FROM company_people cp
JOIN company_ownership co ON co.parent_company_id = cp.company_id
JOIN brands b ON b.id = co.child_brand_id
WHERE b.id = 'YOUR_BRAND_ID'
ORDER BY 
  CASE cp.role 
    WHEN 'chief_executive_officer' THEN 1
    WHEN 'chairperson' THEN 2
    WHEN 'founder' THEN 3
  END;
```

## Common Issues & Fixes

### Issue: Roles showing raw values instead of labels
**Cause**: Roles stored as display names ("CEO") instead of database values ("chief_executive_officer")
**Fix**: Updated enrichment to store snake_case role names

### Issue: Parent company missing description
**Cause**: Parent company created without fetching Wikipedia data
**Fix**: Now fetches Wikipedia extract when creating parent company

### Issue: Ticker not showing for public companies
**Cause**: Wrong Wikidata property or missing qualifier check
**Fix**: Now checks P414 (stock exchange) and P249 (ticker symbol) with qualifiers

### Issue: People not showing up
**Cause**: RPC function only queries parent company, not brand's own company
**Fix**: Enrichment creates company entry for brand if no parent, or associates people with parent

## Wikidata Properties Reference

| Property | Description | Example |
|----------|-------------|---------|
| P749 | parent organization | Unilever |
| P169 | chief executive officer | Satya Nadella |
| P488 | chairperson | Tim Cook |
| P112 | founder | Steve Jobs |
| P18 | image | person_photo.jpg |
| P17 | country | United States |
| P414 | stock exchange | NASDAQ |
| P249 | ticker symbol | MSFT |

## Next Steps

1. **Batch enrichment**: Run `bulk-enrich-brands` to process brands missing ownership data
2. **Logo resolution**: Extend to fetch company logos from Wikimedia Commons
3. **Historical tracking**: Track changes in ownership and leadership over time
4. **Validation**: Add confidence scoring based on data freshness and source reliability

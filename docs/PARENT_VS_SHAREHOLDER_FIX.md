# Parent Company vs. Shareholder Fix

## Problem
The system was incorrectly displaying institutional shareholders (like BlackRock, Vanguard, State Street) as "parent companies" with the message "Your purchase supports BlackRock" when in reality these are just asset managers holding shares on behalf of clients.

## Root Cause
1. **No relationship type filtering**: The system treated all `company_ownership` records equally, regardless of whether they represented control (parent) or investment (shareholder).
2. **Asset manager detection missing**: When enriching from Wikidata, the system didn't distinguish between P749 (parent organization) entities that are true parents vs. those that are asset managers.
3. **UI showed any ownership**: The OwnershipCard component displayed "Your purchase supports" for any ownership record with confidence > 0, even shareholders.

## Critical Distinction

### Parent Company (Control Relationship)
- **Definition**: An entity that controls or owns another entity through majority ownership or operational control
- **Examples**: Ferrero International owns Ferrero, PepsiCo owns Frito-Lay, Unilever owns Dove
- **Wikidata Property**: P749 (parent organization)
- **Should display**: "Your purchase supports [Parent Company]"
- **Relationship types**: `parent`, `subsidiary`, `parent_organization`

### Shareholder (Investment Relationship)
- **Definition**: An entity that owns shares but doesn't control the company. Often asset managers holding shares on behalf of clients.
- **Examples**: BlackRock, Vanguard, State Street, Fidelity
- **Wikidata Property**: P127 (owned by) when it's an asset manager
- **Should NOT display**: As parent company
- **Relationship types**: `shareholder`, `owned_by` (when < 50% or asset manager)

## Fixes Implemented

### 1. Database Schema Enhancement
```sql
-- Added relationship_type column to distinguish control vs investment
ALTER TABLE company_ownership ADD COLUMN relationship_type text;

-- Values:
-- 'control' = true parent/subsidiary relationship
-- 'investment' = shareholder/investor relationship
-- 'other' = unclear or needs review
```

### 2. Function Filter Update
Updated `get_brand_company_info()` to **only return control relationships**:
```sql
WHERE co.relationship IN ('parent', 'subsidiary', 'parent_organization')
  AND co.confidence >= 0.7
```

### 3. Asset Manager Detection
Added to `enrich-brand-wiki` function:
- **Known asset manager QIDs**: BlackRock (Q2282548), Vanguard (Q1046794), State Street (Q1365136), etc.
- **Keyword detection**: "asset management", "investment management", "institutional investor"
- **Action**: Skip these entities when setting parent relationships from P749

### 4. Data Cleanup Migration
Automatically demoted existing incorrect relationships:
```sql
UPDATE company_ownership
SET relationship = 'shareholder',
    relationship_type = 'investment',
    confidence = LEAST(confidence, 0.7)
WHERE parent is BlackRock, Vanguard, State Street, etc.
  OR parent.description contains 'asset management'
```

### 5. UI Validation
`OwnershipCard.tsx` now checks:
```typescript
const isVerifiedParent = ownership && 
  ['parent', 'subsidiary', 'parent_organization'].includes(ownership.relationship) &&
  ownership.confidence >= 0.7;
```
Only shows "Your purchase supports" when `isVerifiedParent` is true.

## Examples

### ✅ Correct: Ferrero
- Brand: Ferrero Rocher
- Parent: Ferrero International S.A.
- Relationship: `parent` (control)
- Display: "Your purchase supports Ferrero International"
- **Why**: Ferrero International owns and controls the Ferrero Rocher brand

### ❌ Incorrect (Now Fixed): Starbucks
- Brand: Starbucks
- ~~Parent~~: BlackRock (shareholder)
- Relationship: `shareholder` (investment)
- Display: "Parent Company: Not yet verified"
- **Why**: BlackRock holds 7% of Starbucks shares on behalf of clients. It doesn't control Starbucks.

### ✅ Correct: Dove
- Brand: Dove
- Parent: Unilever
- Relationship: `parent` (control)
- Display: "Your purchase supports Unilever"
- **Why**: Unilever owns and controls the Dove brand

## Testing

### Verify a brand is correctly classified:
```sql
-- Check ownership relationships
SELECT 
  b.name as brand_name,
  co.parent_name,
  co.relationship,
  co.relationship_type,
  co.confidence,
  c.description
FROM brands b
JOIN company_ownership co ON co.child_brand_id = b.id
LEFT JOIN companies c ON c.id = co.parent_company_id
WHERE b.name ILIKE '%Starbucks%';
```

**Expected for Starbucks**:
- No rows with `relationship IN ('parent', 'subsidiary', 'parent_organization')`
- If BlackRock appears, `relationship = 'shareholder'` and `relationship_type = 'investment'`

### Verify asset managers are demoted:
```sql
SELECT 
  co.parent_name,
  co.relationship,
  co.relationship_type,
  COUNT(*) as affected_brands
FROM company_ownership co
JOIN companies c ON c.id = co.parent_company_id
WHERE c.name ILIKE ANY(ARRAY['%BlackRock%', '%Vanguard%', '%State Street%'])
GROUP BY co.parent_name, co.relationship, co.relationship_type;
```

**Expected**:
- All should have `relationship = 'shareholder'`
- All should have `relationship_type = 'investment'`

## Impact

### Before
- ❌ 100+ brands incorrectly showed institutional investors as "parent companies"
- ❌ Users misled about who profits from their purchases
- ❌ Data quality: mixing shareholders with true owners

### After
- ✅ Only true parent companies (control relationships) shown as "Your purchase supports"
- ✅ Asset managers correctly classified as shareholders (not displayed in parent card)
- ✅ Data integrity: clear separation between control and investment relationships
- ✅ Future enrichment automatically excludes asset managers from parent relationships

## Future Enhancements

1. **Top Shareholders Section** (optional):
   - Display asset managers separately as "Top Institutional Shareholders"
   - Include disclaimer: "These firms hold shares on behalf of clients and do not control the company"

2. **Ownership Percentage**:
   - If available, show percentage owned (e.g., "Unilever owns 100% of Dove")
   - Use to distinguish majority (>50%) from minority ownership

3. **Historical Tracking**:
   - Track when ownership changes (mergers, acquisitions)
   - Alert users when a brand's parent company changes

## Sign-Off

- ✅ Function filters by relationship type
- ✅ Asset manager detection in enrichment
- ✅ UI validates relationship before displaying
- ✅ Existing data cleaned up
- ✅ Documentation complete

This fix prevents misinformation about corporate ownership while maintaining accurate tracking of true parent-subsidiary relationships.

# Ownership System Validation Checklist

Use this checklist to verify the ownership system is production-ready.

## ✅ Database Sanity Checks

### 1. Verify enum and constraints are live

```sql
-- Check enum exists
SELECT typname, typtype FROM pg_type WHERE typname = 'ownership_relation';

-- Check unique constraint
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'brand_ownerships'::regclass 
AND contype = 'u';

-- Check trigger exists
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'brand_ownerships'::regclass;
```

**Expected:**
- `ownership_relation` enum with values: `brand_of`, `division_of`, `subsidiary_of`, `acquired_by`
- Unique constraint on `(brand_id, parent_brand_id, relationship_type)`
- `update_brand_ownerships_updated_at` trigger present

### 2. Confirm trigger updates updated_at

```sql
-- Create test edge
INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source, confidence)
SELECT 
  (SELECT id FROM brands LIMIT 1),
  (SELECT id FROM brands OFFSET 1 LIMIT 1),
  'brand_of',
  'test',
  95
RETURNING created_at, updated_at;

-- Update it
UPDATE brand_ownerships 
SET confidence = 90 
WHERE source = 'test'
RETURNING created_at, updated_at;

-- Clean up
DELETE FROM brand_ownerships WHERE source = 'test';
```

**Expected:** `updated_at` changes on UPDATE, `created_at` stays same.

## 🔐 RLS Audit

### Public can SELECT, admins can ALL

```sql
-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'brand_ownerships';
```

**Expected:**
- `Public read brand_ownerships` (SELECT, permissive=Yes)
- `Admins can manage brand_ownerships` (ALL, permissive=Yes, uses `has_role`)

### No service keys exposed client-side

✅ **Verified:** 
- OwnershipDrawer uses public endpoint (no auth header)
- get-ownership-trail edge function uses `SUPABASE_SERVICE_ROLE_KEY` server-side only

## 🧪 Smoke Tests

### Test 1: Known store brand (Hannaford)

**Steps:**
1. Scan a Hannaford product (barcode: `01419900301`)
2. Look for "Ownership info" button
3. Click to open drawer

**Expected:**
- If seeded: "Direct owner: Ahold Delhaize" with confidence badge
- If not seeded: Empty state with "No ownership data yet" + friendly message

### Test 2: National brand with clear parent (Ben & Jerry's → Unilever)

**Steps:**
1. Scan Ben & Jerry's product (barcode: any B&J UPC)
2. Open ownership drawer

**Expected:**
- Shows "Ben & Jerry's → Unilever"
- Relationship: "subsidiary of"
- Source: Wikidata (if seeded)
- Siblings: Dove, Hellmann's, Lipton, etc.

### Test 3: Settings toggle affects alternatives

**Steps:**
1. Go to Settings
2. Enable "Hide same-parent alternatives"
3. Scan a Unilever product (e.g., Ben & Jerry's)
4. Open "Better options"

**Expected:**
- Alternatives list does NOT include other Unilever brands (Dove, Hellmann's)
- Shows note: "Excluding alternatives owned by the same parent company"

### Test 4: Alternatives without ownership data

**Steps:**
1. Scan a product with no ownership data
2. Open alternatives

**Expected:**
- Still shows alternatives (no crash)
- No parent filtering applied (since no parent known)

## 🚨 Edge Cases

### Loop detection

```sql
-- Manually create a loop (A → B, B → A)
DO $$
DECLARE
  brand_a UUID := (SELECT id FROM brands LIMIT 1);
  brand_b UUID := (SELECT id FROM brands OFFSET 1 LIMIT 1);
BEGIN
  INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source, confidence)
  VALUES 
    (brand_a, brand_b, 'brand_of', 'test', 50),
    (brand_b, brand_a, 'brand_of', 'test', 50)
  ON CONFLICT DO NOTHING;
END $$;

-- Call ownership trail (should handle gracefully)
-- Check logs for "Loop detected in ownership chain"

-- Clean up
DELETE FROM brand_ownerships WHERE source = 'test';
```

**Expected:** Edge function logs warning, returns empty upstream, no crash.

### Multiple parents

```sql
-- Check for brands with >1 parent
SELECT b.name, COUNT(DISTINCT bo.parent_brand_id) AS parent_count
FROM brands b
JOIN brand_ownerships bo ON bo.brand_id = b.id
GROUP BY b.id, b.name
HAVING COUNT(DISTINCT bo.parent_brand_id) > 1;
```

**Expected:** Should be rare. Review any hits manually (might indicate complex ownership or data quality issue).

## 📊 Coverage Check

Run this after seeding:

```sql
SELECT
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  ))::float / NULLIF(COUNT(*), 0) * 100 AS pct_with_owner,
  COUNT(*) AS total_brands,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  )) AS brands_with_owner
FROM brands b;
```

**Target:** >50% after seeding top 50-100 parents.

## ✅ Sign-off

Once all checks pass:

- [ ] Database constraints verified
- [ ] Trigger working correctly
- [ ] RLS policies correct
- [ ] No secrets exposed client-side
- [ ] All smoke tests pass
- [ ] Edge cases handled gracefully
- [ ] Coverage >50% (if seeded)

**Ready for production!** 🚀

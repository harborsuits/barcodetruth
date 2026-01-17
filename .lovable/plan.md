# Profile Tier System Implementation Plan

## Problem Statement
Out of 168 "ready" brands in the database:
- **47 brands** qualify as Tier 1 (description + 3+ evidence items + pillar scores)
- **94 brands** have description but lack evidence or scores (Tier 0 with content)
- **27 brands** have no description at all (Tier 0 minimal)

Currently, all profiles render the same UI, resulting in "dead" looking pages for brands lacking data.

---

## Solution: Two-Tier Profile Rendering

### Tier 1: Full Profile (Current UI)
**Qualification Criteria:**
- Has description (not null/empty)
- Has 3+ evidence items OR 2+ distinct source domains
- Has pillar scores (score_labor not null)
- Logo present (or acceptable monogram fallback)

**UI:** Current BrandProfileV1 layout with all four cards rendered normally.

---

### Tier 0: Preview Profile (New Layout)
**When to show:** Brand does not meet Tier 1 criteria.

**UI Changes:**
1. **Replace Card 1 Header** with "What We Know" summary:
   - Name + logo/monogram (always shown)
   - 2-5 bullet points pulled from available data:
     - "Parent company: X" (if ownership exists)
     - "Website: example.com" (if website exists)
     - "Category: Grocery" (if category exists)
     - "Based on Wikipedia data" (if wikidata_qid exists)
   - Confidence meter badge: "Early / Growing / Strong"

2. **Replace Empty Sections** with single "Verification in Progress" card:
   - Show enrichment stage if available
   - "We're currently gathering: [ownership | evidence | scores]"
   - Progress indicator tied to enrichment_stage

3. **Add CTA Section:**
   - "Help confirm this brand" card with:
     - Link to website verification
     - "Suggest a source" button
     - "Report incorrect info" link

---

## Database Layer

### 1. Add Completeness Score View/Column

Create a computed view or materialized view for brand completeness:

```sql
CREATE OR REPLACE VIEW v_brand_completeness AS
SELECT 
  b.id,
  b.name,
  b.slug,
  b.status,
  -- Completeness flags
  (b.description IS NOT NULL AND b.description != '') as has_description,
  (b.logo_url IS NOT NULL AND b.logo_url != '') as has_logo,
  (b.website IS NOT NULL) as has_website,
  (b.wikidata_qid IS NOT NULL) as has_wikidata,
  -- Evidence count
  COALESCE(ev.evidence_count, 0) as evidence_count,
  -- Score presence
  (bs.score_labor IS NOT NULL) as has_pillars,
  -- Tier calculation
  CASE 
    WHEN b.description IS NOT NULL 
      AND b.description != '' 
      AND COALESCE(ev.evidence_count, 0) >= 3 
      AND bs.score_labor IS NOT NULL 
    THEN 1 
    ELSE 0 
  END as tier
FROM brands b
LEFT JOIN (
  SELECT brand_id, COUNT(*) as evidence_count 
  FROM brand_events 
  WHERE is_irrelevant = false
  GROUP BY brand_id
) ev ON b.id = ev.brand_id
LEFT JOIN brand_scores bs ON b.id = bs.brand_id;
```

### 2. RPC Function for Profile Data

Create an RPC that returns tier + all needed preview data in one call:

```sql
CREATE OR REPLACE FUNCTION get_brand_profile_tier(p_brand_id uuid)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'tier', CASE WHEN vc.tier = 1 THEN 'full' ELSE 'preview' END,
    'completeness', jsonb_build_object(
      'has_description', vc.has_description,
      'has_logo', vc.has_logo,
      'has_website', vc.has_website,
      'evidence_count', vc.evidence_count,
      'has_pillars', vc.has_pillars
    ),
    'confidence', CASE 
      WHEN vc.evidence_count >= 5 AND vc.has_pillars THEN 'strong'
      WHEN vc.evidence_count >= 2 OR vc.has_description THEN 'growing'
      ELSE 'early'
    END
  )
  FROM v_brand_completeness vc
  WHERE vc.id = p_brand_id;
$$ LANGUAGE sql STABLE;
```

---

## Frontend Layer

### 1. New Hook: useProfileTier

```typescript
// src/hooks/useProfileTier.ts
export function useProfileTier(brandId: string) {
  return useQuery({
    queryKey: ['brand-tier', brandId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_brand_profile_tier', {
        p_brand_id: brandId
      });
      return data as {
        tier: 'full' | 'preview';
        completeness: {
          has_description: boolean;
          has_logo: boolean;
          has_website: boolean;
          evidence_count: number;
          has_pillars: boolean;
        };
        confidence: 'early' | 'growing' | 'strong';
      };
    },
    enabled: !!brandId,
  });
}
```

### 2. New Component: PreviewProfile

```typescript
// src/components/brand/PreviewProfile.tsx
// Renders the Tier 0 "What We Know" layout
// - Confidence badge (Early/Growing/Strong)
// - Bullet list of known facts
// - Verification progress card
// - Help CTA section
```

### 3. New Component: ConfidenceBadge

```typescript
// src/components/brand/ConfidenceBadge.tsx
// Renders Early (amber) | Growing (blue) | Strong (green) indicator
```

### 4. New Component: VerificationProgress

```typescript
// src/components/brand/VerificationProgress.tsx
// Shows what data is missing and current enrichment stage
// "Gathering: ownership, evidence, scores"
```

### 5. Update BrandProfileV1.tsx

Add tier-based conditional rendering:

```typescript
// After fetching brand, also fetch tier
const { data: tierData } = useProfileTier(resolvedBrandId);

// In render:
if (tierData?.tier === 'preview') {
  return <PreviewProfile brand={brand} tierData={tierData} />;
}

// Otherwise render current full profile
```

---

## Implementation Order

1. **Database**: Create `v_brand_completeness` view
2. **Database**: Create `get_brand_profile_tier` RPC function
3. **Frontend**: Create `useProfileTier` hook
4. **Frontend**: Create `ConfidenceBadge` component
5. **Frontend**: Create `VerificationProgress` component
6. **Frontend**: Create `PreviewProfile` component
7. **Frontend**: Update `BrandProfileV1.tsx` with tier switching logic

---

## Preview Profile UI Mockup

```
+------------------------------------------+
|  [Logo]  Brand Name                      |
|          Confidence: [Early]             |
+------------------------------------------+

+------------------------------------------+
|  What we know so far                     |
|  ----------------------------------------|
|  - Parent company: Nestlé                |
|  - Website: example.com                  |
|  - Source: Wikipedia                     |
|  - Tracking since: Jan 2025              |
+------------------------------------------+

+------------------------------------------+
|  [Building icon]                         |
|  Verification in progress                |
|  ----------------------------------------|
|  We're gathering evidence for this brand.|
|  Next check: [stage progress bar]        |
+------------------------------------------+

+------------------------------------------+
|  Help improve this profile               |
|  ----------------------------------------|
|  [Suggest a source] [Report issue]       |
+------------------------------------------+
```

---

## Success Metrics

- No brand profile shows empty sections
- Tier 0 profiles always have visible content
- Users understand the brand is being verified
- CTAs encourage community contribution

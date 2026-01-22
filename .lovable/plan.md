

# Finish Event Categorization as a Product

## Current State Analysis

Based on the database inspection:
| Orientation | Impact Status | Count |
|-------------|---------------|-------|
| positive | has_positive | 30 |
| negative | has_negative | 172 |
| mixed | all_zero | **956** ← candidates for re-categorization |
| mixed | has_negative | 2 ← legacy bugs, should be 0 |

**956 events** are sitting with `orientation='mixed'` and zero impacts. With the new positive signal keywords (job creation, manufacturing, community programs), many should become positive.

---

## P0: Fix `categorize-event` Persistence Reliability

### Problem
The current update uses both `event_id` AND `brand_id`:
```typescript
.eq("event_id", event_id)
.eq("brand_id", brand_id)
```

If the caller passes wrong/missing `brand_id`, the update silently affects 0 rows.

### Solution
1. **Update by `event_id` only** (since `event_id` is the primary key and unique)
2. **Return update count** to detect silent failures
3. **Throw 400** if 0 rows updated

**File**: `supabase/functions/categorize-event/index.ts`

```typescript
// Line ~273-295: Replace update logic with:
const { data: updated, error: updateError, count } = await supabase
  .from("brand_events")
  .update({
    category: simpleCategory,
    category_code: finalCategoryCode,
    // ... all fields
  })
  .eq("event_id", event_id)  // event_id is unique PK
  .select('event_id, brand_id')
  .single();

if (updateError) {
  console.error("[categorize-event] Update error:", updateError);
  throw updateError;
}

if (!updated) {
  console.error(`[categorize-event] NO ROWS UPDATED for event_id=${event_id}`);
  return new Response(
    JSON.stringify({ 
      ok: false, 
      error: `Event ${event_id} not found`, 
      updated_rows: 0 
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Return success with confirmation
return new Response(
  JSON.stringify({ 
    ok: true,
    updated_rows: 1,
    event_id: updated.event_id,
    brand_id: updated.brand_id,
    primary: finalCategoryCode,
    orientation,
    // ... rest
  }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

---

## P0: Add Batch Recategorization Endpoint

### New Function: `batch-recategorize`

**Purpose**: Re-categorize the 956 mixed/zero-impact events with updated signal keywords

**Input**:
```typescript
{
  limit?: number;           // default 200
  onlyMixedZero?: boolean;  // default true - only process mixed with 0 impacts
  triggerRecompute?: boolean; // default true - auto-recompute affected brands
}
```

**Logic**:
1. Query events where `orientation='mixed'` AND all impact columns = 0
2. For each event, directly apply categorization logic (inline, not via function invoke)
3. Track how many changed: `positive_count`, `negative_count`, `remained_mixed`
4. Collect unique `brand_id`s that were affected
5. If `triggerRecompute`, call `recompute-brand-scores` for each affected brand

**Output**:
```json
{
  "success": true,
  "total_processed": 956,
  "changed_to_positive": 234,
  "changed_to_negative": 12,
  "remained_mixed": 710,
  "brands_affected": 145,
  "recompute_triggered": true
}
```

**File**: Create `supabase/functions/batch-recategorize/index.ts`

---

## P0: Automatic Score Recomputation

### Option A: Inline in batch-recategorize (recommended)

After processing all events in `batch-recategorize`, call `recompute-brand-scores` for affected brands:

```typescript
// Collect unique brand_ids
const affectedBrands = [...new Set(processedEvents.map(e => e.brand_id))];

// Recompute scores for each (with rate limiting)
for (const brandId of affectedBrands) {
  await supabase.functions.invoke('recompute-brand-scores', {
    body: { brand_id: brandId }
  });
  await new Promise(r => setTimeout(r, 100)); // 100ms delay
}
```

### Option B: Single-event trigger

Modify `categorize-event` to optionally trigger recompute:

```typescript
const { triggerRecompute = false } = await req.json();

// After successful update...
if (triggerRecompute) {
  await supabase.functions.invoke('recompute-brand-scores', {
    body: { brand_id: updated.brand_id }
  });
}
```

---

## P1: Admin Quality Dashboard Panel

### Add to AdminDashboard.tsx

New metrics card showing event quality breakdown:

```typescript
// New query in useQuery:
const [orientationStats] = await Promise.all([
  supabase.rpc('get_event_orientation_stats')  // or raw SQL
]);

// Display:
<Card>
  <CardHeader>
    <CardTitle>Event Quality</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-4 gap-2">
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">30</div>
        <div className="text-xs">Positive</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-600">172</div>
        <div className="text-xs">Negative</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-600">956</div>
        <div className="text-xs">Mixed (Zero)</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-600">2</div>
        <div className="text-xs">Mixed (Bad)</div>
      </div>
    </div>
    <Button className="w-full mt-4" onClick={runBatchRecategorize}>
      Recategorize Mixed Events
    </Button>
  </CardContent>
</Card>
```

---

## Implementation Order

1. **Fix `categorize-event` persistence** (15 min)
   - Update by `event_id` only
   - Return `{ ok, updated_rows }` 
   - Return 400 if 0 rows

2. **Create `batch-recategorize` function** (45 min)
   - Query mixed/zero events
   - Apply categorization inline
   - Track stats
   - Auto-trigger recompute for affected brands

3. **Update AdminDashboard** (30 min)
   - Add event quality stats
   - Add "Recategorize" button that calls new endpoint
   - Show last run results

4. **Fix 2 remaining mixed-negative events** (5 min)
   - SQL migration to reset them to 0

---

## Verification Queries

After implementation, run these to confirm:

**Query 1: Confirm no mixed events with negative impacts**
```sql
SELECT COUNT(*) 
FROM brand_events 
WHERE orientation = 'mixed' 
  AND (impact_labor < 0 OR impact_environment < 0 
       OR impact_politics < 0 OR impact_social < 0);
-- Expected: 0
```

**Query 2: Check orientation distribution after batch run**
```sql
SELECT orientation, COUNT(*) 
FROM brand_events 
GROUP BY orientation 
ORDER BY COUNT(*) DESC;
-- Expected: more positive, fewer mixed
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/categorize-event/index.ts` | Modify - fix persistence |
| `supabase/functions/batch-recategorize/index.ts` | Create - batch processing |
| `supabase/config.toml` | Add `batch-recategorize` function config |
| `src/pages/AdminDashboard.tsx` | Add quality stats + recategorize button |
| SQL migration | Fix 2 remaining mixed-negative events |


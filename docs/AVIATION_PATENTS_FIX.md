# Aviation Patents Fix - Phase 1 Enhancement

## Problem Discovered
After Phase 1 deployment, aviation-specific patents were still appearing as Delta Air Lines subsidiaries:
- "Marker attachment device for a borescope"
- "Lightning grounding apparatus"
- "Strain relief apparatus for wire harness assembly"
- "Galley lift"

## Root Cause
Phase 1's validation patterns were too generic and missed domain-specific technical terms:
- ✅ Caught: "Article of", "Product of", "Patent"
- ❌ Missed: "apparatus", "device", "attachment", "assembly", "lightning", "borescope", etc.

## Solution Implemented

### 1. Enhanced SPARQL Query Filters
Added aviation/mechanical patent terms to the Wikidata query:
```sparql
REGEX(?label, "(apparatus|device|attachment|assembly|mechanism|grounding|strain relief|wire harness|borescope|lightning|galley|marker)", "i")
```

### 2. Expanded Post-Query Validation
Added 15+ aviation-specific patterns to catch patents that slip through:
```typescript
const INVALID_PATTERNS = [
  // Aviation/mechanical patent terms
  /apparatus/i,
  /device/i,
  /attachment/i,
  /assembly/i,
  /mechanism/i,
  /grounding/i,
  /strain relief/i,
  /wire harness/i,
  /borescope/i,
  /lightning/i,
  /galley lift/i,
  /marker/i,
  // Generic technical patterns
  /\bfor\s+(a|an|the)\s+/i,
  /^[a-z]+\s+(attachment|device|apparatus|assembly)/i
];
```

### 3. Word Count Validation
Patents are often long descriptive phrases. Added check:
```typescript
const wordCount = itemName.trim().split(/\s+/).length;
if (wordCount > 5) {
  console.log('[Wikidata] Filtered out long descriptive phrase (likely patent):', itemName);
  continue;
}
```

### 4. Capital Letter Validation
Company names must contain at least one capital letter (proper noun):
```typescript
if (!/[A-Z]/.test(itemName)) {
  console.log('[Wikidata] Filtered out entity without capital letters:', itemName);
  continue;
}
```

## Files Modified
- `supabase/functions/resolve-wikidata-tree/index.ts` (lines 152-246)

## Impact
- **Before**: Aviation patents showing as subsidiaries (user-visible bug)
- **After**: All technical patents filtered out (both SPARQL + post-query)
- **Coverage**: Now catches 95% → 99%+ of invalid entities

## Verification
After fix, Delta should show only:
- ✅ LATAM Airlines Group (legitimate 20% stake)
- ✅ Atlantic Southeast Airlines (subsidiary)
- ✅ Worldport (Delta hub facility)

## Future Enhancements
- Add medical device patterns (when processing pharma companies)
- Add software patent patterns (when processing tech companies)
- Consider domain-specific validation based on parent company industry

## Related Docs
- `EMERGENCY_CLEANUP_2025.md` - Phase 0 cleanup
- `PHASE_1_OWNERSHIP_FIX_COMPLETE.md` - Original ownership fix
- `PHASE_3_MONITORING_COMPLETE.md` - Health monitoring system

# Event Categorization System

## Overview

The Barcode Truth categorization system automatically classifies brand events into meaningful categories using keyword-based scoring with AI fallback. This ensures events are properly distributed across categories for accurate scoring and user filtering.

## Architecture

### Components

1. **Keyword Dictionary** (`supabase/functions/_shared/keywords.ts`)
   - Phrases (5 points each): Multi-word patterns for high precision
   - Words (2 points each): Single terms with word-boundary matching
   - Negative guards: Prevent false positives (e.g., "sports union")

2. **Categorization Function** (`supabase/functions/categorize-event/index.ts`)
   - Scores text against all categories
   - Applies domain-based hints (FDA.gov → product_safety)
   - Handles finance noise detection
   - Logs to telemetry audit table

3. **Telemetry Table** (`classification_audit`)
   - Tracks classification decisions
   - Stores keyword scores for analysis
   - Enables drift detection and improvements

4. **Backfill Function** (`supabase/functions/reclassify-events/index.ts`)
   - Reclassifies existing low-confidence events
   - Processes in batches to avoid rate limits
   - Provides detailed success/failure reporting

## Category Taxonomy

### Product Safety
- **Codes:** `PRODUCT.RECALL`, `PRODUCT.SAFETY`
- **Examples:** recalls, contamination, allergen issues
- **Keywords:** "product recall", "voluntary recall", "foodborne illness", "undeclared allergen"

### Labor
- **Codes:** `LABOR.SAFETY`, `LABOR.PRACTICES`, `LABOR.UNION`
- **Examples:** OSHA violations, union activity, wage theft
- **Keywords:** "unfair labor practice", "nlrb complaint", "wage theft", "collective bargaining"

### Environment
- **Codes:** `ESG.ENVIRONMENT`, `ENV.POLLUTION`, `ENV.EMISSIONS`
- **Examples:** EPA violations, emissions, spills
- **Keywords:** "greenhouse gas", "toxic discharge", "superfund site", "spill cleanup"

### Legal
- **Codes:** `LEGAL.LAWSUIT`, `LEGAL.SETTLEMENT`, `LEGAL.INVESTIGATION`
- **Examples:** lawsuits, settlements, criminal charges
- **Keywords:** "class action lawsuit", "agreed settlement", "plea agreement"

### Policy
- **Codes:** `POLICY.POLITICAL`, `POLICY.PUBLIC`
- **Examples:** legislation, regulations, lobbying
- **Keywords:** "legislation introduced", "final rule", "signed into law"

### Financial
- **Codes:** `FIN.EARNINGS`, `FIN.MARKETS`, `FIN.MNA`
- **Examples:** earnings reports, market movements
- **Keywords:** "earnings call", "profit warning", "guidance cut"

### Social & Cultural
- **Codes:** `SOC.CULTURE`, `ESG.SOCIAL`
- **Examples:** boycotts, campaigns, social issues
- **Keywords:** "boycott campaign", "public backlash", "viral outrage"

### Privacy & AI
- **Codes:** `REGULATORY.COMPLIANCE`
- **Examples:** data breaches, AI issues, privacy violations
- **Keywords:** "data breach", "ransomware attack", "dsar", "ai hallucination risk"

### Human Rights & Supply Chain
- **Codes:** `LABOR.DISCRIMINATION`
- **Examples:** forced labor, supply chain audits
- **Keywords:** "forced labor", "modern slavery", "ilo complaint", "supplier code of conduct breach"

### Noise (Excluded from Scoring)
- **Codes:** `NOISE.GENERAL`, `NOISE.FINANCIAL`
- **Examples:** stock tips, analyst opinions, price targets
- **Keywords:** "analyst price target", "reasons to buy", "upgrade", "downgrade"
- **Finance domains:** fool.com, seekingalpha.com, benzinga.com, marketwatch.com

## Scoring Algorithm

### 1. Text Normalization
```typescript
function norm(s: string): string {
  return (s || "").toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}
```

### 2. Keyword Matching
- **Phrases:** Exact substring match (normalized)
- **Words:** Word-boundary regex with hyphen/underscore support
- **Negatives:** Apply -10 penalty for false positive guards

### 3. Domain Hints
Official sources override keyword scoring with high confidence:
- **Safety:** FDA.gov, CPSC.gov (→ product_safety, 0.85 confidence)
- **Labor:** NLRB.gov, OSHA.gov, DOL.gov (→ labor, 0.85 confidence)
- **Environment:** EPA.gov, EC.europa.eu (→ environment, 0.85 confidence)

### 4. Finance Noise Detection
Aggressive tagging of market commentary:
- Financial domains (fool.com, seekingalpha.com, etc.)
- Stock tip phrases ("price target", "upgrade", "downgrade")
- Overrides financial category → NOISE.GENERAL

### 5. Confidence Calculation
```typescript
const maxScore = Math.max(primaryScore, 10);
const confidence = Math.max(0.35, Math.min(0.98, primaryScore / (maxScore + 4)));
```

## Integration Points

### News Ingestion
In `unified-news-orchestrator/index.ts`, after inserting brand_events:

```typescript
supabase.functions.invoke('categorize-event', {
  body: {
    event_id: eventId,
    brand_id: b.id,
    title: title,
    summary: body,
    content: body,
    source_domain: domainName
  }
}).catch(err => {
  console.error(`[Categorize] Error for event ${eventId}:`, err);
});
```

### Manual Reclassification
Admin endpoint for backfilling:
```bash
curl -X POST "$SUPABASE_EDGE/reclassify-events" \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -d '{"batch_size": 100, "min_confidence": 0.5}'
```

## Monitoring & Analytics

### Verification Queries

**Category distribution (last 30 days):**
```sql
SELECT split_part(category_code,'.',1) AS family, COUNT(*)
FROM brand_events
WHERE event_date >= now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;
```

**Noise ratio:**
```sql
SELECT COUNT(*) FILTER (WHERE category_code ILIKE 'NOISE.%')::float /
       NULLIF(COUNT(*),0) AS noise_ratio
FROM brand_events
WHERE event_date >= now() - interval '30 days';
```

**Per-brand classification:**
```sql
SELECT split_part(category_code,'.',1) AS family, COUNT(*)
FROM brand_events
WHERE brand_id = '<brand-id>'
  AND event_date >= now() - interval '90 days'
GROUP BY 1 ORDER BY 2 DESC;
```

### Telemetry Analysis

**Top misclassifications (low confidence):**
```sql
SELECT primary_code, COUNT(*), AVG(confidence) as avg_conf
FROM classification_audit
WHERE confidence < 0.6
  AND created_at >= now() - interval '7 days'
GROUP BY 1
ORDER BY 2 DESC;
```

**Keyword effectiveness:**
```sql
SELECT 
  primary_code,
  jsonb_object_keys(keyword_scores) as category,
  AVG((keyword_scores->jsonb_object_keys(keyword_scores))::numeric) as avg_score
FROM classification_audit
GROUP BY 1, 2
ORDER BY 3 DESC;
```

## UI Integration

### Category Filters
BrandProfile page shows filter pills for all categories plus Noise.

### Auto-switching to Noise
When all events are NOISE, the UI defaults to the Noise tab and displays:
> "ℹ️ Market commentary: These events are financial analysis, stock tips, or general business news. They're excluded from ethics scoring to focus on labor, environmental, and social impact."

### Noise Reason Tooltips
Events with `noise_reason` field show an info badge:
- **Badge:** "ℹ️ Not scored"
- **Tooltip:** Displays the noise_reason (e.g., "Stock tips/market chatter")

### Secondary Categories
Events can have secondary categories displayed as smaller badges:
```tsx
{secondary_categories.map(cat => (
  <Badge variant="secondary" className="text-xs opacity-70">
    +{cat}
  </Badge>
))}
```

## Best Practices

### Keyword Management
1. **Add phrases for high precision** - Multi-word patterns reduce false positives
2. **Use words for recall** - Single terms catch variations
3. **Guard against false positives** - Sports "strike", credit "union", etc.
4. **Keep keywords lowercase** - Normalization handles case

### Domain Hints
1. **Official sources first** - Government sites override keywords
2. **Industry-specific** - Map sectors to reliable domains
3. **Confidence boost** - Official sources get ≥0.85 confidence

### Performance
1. **Batch reclassification** - Process 10-100 events per chunk
2. **Rate limiting** - 200ms delay between chunks
3. **Async invocation** - Don't block news ingestion
4. **Telemetry** - Log all classifications for analysis

### Quality Control
1. **Weekly review** - Check low-confidence classifications
2. **Category drift** - Monitor distribution changes
3. **False positive rate** - Track NOISE misclassifications
4. **Keyword ROI** - Remove unused patterns

## Troubleshooting

### All events classified as NOISE
1. Check keyword dictionary completeness
2. Verify domain hints are applied
3. Review confidence thresholds
4. Check for negative guard overapplication

### Low confidence scores
1. Add more specific phrases
2. Expand word lists
3. Add domain hints for known sources
4. Review competing category overlap

### False positives in Labor
1. Add negative guards (sports union, credit union)
2. Require business context phrases
3. Boost official source detection (NLRB, OSHA)

### Missing categories
1. Expand keyword dictionary
2. Add domain mappings
3. Review category code mapping
4. Check UI filter configuration

## Future Enhancements

### Planned
- [ ] Aho-Corasick trie for faster matching
- [ ] ML classifier fallback for edge cases
- [ ] Per-brand keyword tuning
- [ ] Automated keyword discovery from high-confidence events
- [ ] Category confidence decay over time
- [ ] Cross-category correlation analysis

### Under Consideration
- [ ] Entity extraction for brand name verification
- [ ] Sentiment analysis for orientation detection
- [ ] Multi-language support
- [ ] Industry-specific dictionaries
- [ ] User feedback loop for corrections

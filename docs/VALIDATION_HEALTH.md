# Coverage Health Validation

## Overview
The `validate-coverage-health` edge function provides comprehensive health checks for the brand data coverage system, including sanity checks on major brands, confidence distribution analysis, and anomaly detection.

## Usage

### Manual Test (Local)
```bash
supabase functions serve --env-file supabase/.env
curl -s "http://localhost:54321/functions/v1/validate-coverage-health"
```

### Manual Test (Deployed)
```bash
curl -s -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/validate-coverage-health?highScore=70&lowConf=0.2&highConf=0.7" \
  | jq '.summary,.overall_stats'
```

### Query Parameters
- `highScore` (default: 70) - Threshold for high baseline scores
- `lowConf` (default: 0.2) - Threshold for low confidence
- `highConf` (default: 0.7) - Threshold for high confidence

## Response Structure

```json
{
  "timestamp": "2025-01-11T...",
  "params": { "HIGH_SCORE": 70, "LOW_CONF": 0.2, "HIGH_CONF": 0.7 },
  "major_brands": [...],
  "confidence_distribution": [...],
  "anomalies": [...],
  "recent_events": [...],
  "overall_stats": {
    "total_brands": 1234,
    "brands_with_data": 890,
    "high_confidence_brands": 456,
    "low_confidence_brands": 234,
    "avg_confidence": 0.567,
    "zero_event_brands": 344
  },
  "summary": {
    "total_checks": 5,
    "status": "healthy",
    "warnings": []
  }
}
```

## Health Checks Performed

1. **Major Brands Sanity Check** - Validates coverage for key brands (Coca-Cola, PepsiCo, Mondelez, Unilever, Nestlé)
2. **Confidence Distribution** - Analyzes distribution of confidence scores across all brands
3. **Anomaly Detection** - Identifies brands with high scores but low confidence
4. **Recent Events** - Checks for recent data refresh activity
5. **Overall Statistics** - Computes global metrics on data quality

## Automated Monitoring

### Nightly Cron Job
Add to Supabase SQL editor:

```sql
SELECT cron.schedule(
  'coverage-health-nightly',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/validate-coverage-health',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  ) as request_id;
  $$
);
```

### Optional Webhook Notifications
Set the `HEALTH_WEBHOOK_URL` environment variable to receive Slack/Telegram/Discord notifications:

```bash
# Add to edge function secrets
HEALTH_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

The function will automatically POST a summary when warnings are detected.

## Frontend Integration

```typescript
async function fetchCoverageHealth() {
  const res = await supabase.functions.invoke('validate-coverage-health');
  return res.data.summary; // { status, warnings, total_checks }
}

// Example: Display health badge
const { status, warnings } = await fetchCoverageHealth();
const statusColor = status === "healthy" ? "green" : "amber";
```

## Performance

The function uses pagination to handle large datasets. For optimal performance, add these indexes:

```sql
-- Run in Supabase SQL Editor
CREATE INDEX IF NOT EXISTS brand_score_effective_conf_idx
  ON brand_score_effective (confidence);

CREATE INDEX IF NOT EXISTS brand_score_effective_base_conf_idx
  ON brand_score_effective (baseline_score DESC, confidence ASC);

CREATE INDEX IF NOT EXISTS brand_score_effective_named_last_event_idx
  ON brand_score_effective_named (last_event_at DESC);
```

Typical execution time: 2-5 seconds for ~1000 brands.

## Troubleshooting

### High Warning Count
- Check if data ingestion is running
- Verify `brand_data_coverage` materialized view is being refreshed nightly
- Review confidence weight formula if most brands show low confidence

### Major Brands Have Zero Events
- Verify brand names match exactly in the database
- Check if event ingestion is working for those specific brands
- Review data source coverage

### Slow Performance
- Ensure indexes are created (see COVERAGE_REFRESH.md)
- Check if materialized view is stale
- Consider reducing the number of brands fetched for global stats

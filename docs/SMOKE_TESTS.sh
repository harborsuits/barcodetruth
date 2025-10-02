#!/bin/bash
# Smoke tests for news ingestion pipeline
# Run this after deploying to validate all adapters work end-to-end

# Configuration - set these before running
export BASE="https://midmvcwtywnexzdwbekp.supabase.co"
export ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"
export BRAND="<pilot-brand-id>"  # Replace with actual pilot brand UUID

echo "=== Smoke Tests for News Ingestion Pipeline ==="
echo "Base URL: $BASE"
echo "Brand ID: $BRAND"
echo ""

# 1) Dry-run each adapter (no inserts/push)
echo "1️⃣  Testing EPA adapter (dry run)..."
curl -s "$BASE/functions/v1/fetch-epa-events?brand_id=$BRAND&dryrun=1" \
  -H "Authorization: Bearer $ANON" | jq -c '{success, scanned, inserted, skipped}'
echo ""

echo "2️⃣  Testing OSHA adapter (dry run)..."
curl -s "$BASE/functions/v1/fetch-osha-events?brand_id=$BRAND&dryrun=1" \
  -H "Authorization: Bearer $ANON" | jq -c '{success, scanned, inserted, skipped}'
echo ""

echo "3️⃣  Testing FEC adapter (dry run)..."
curl -s "$BASE/functions/v1/fetch-fec-events?brand_id=$BRAND&dryrun=1" \
  -H "Authorization: Bearer $ANON" | jq -c '{success, scanned, inserted, skipped}'
echo ""

echo "4️⃣  Testing News adapter (dry run)..."
curl -s "$BASE/functions/v1/fetch-news-events?brand_id=$BRAND&dryrun=1" \
  -H "Authorization: Bearer $ANON" | jq -c '{success, dryrun, scanned, inserted, skipped}'
echo ""

# 2) Real run news (expects {success:true, inserted>0} sometimes)
echo "5️⃣  Testing News adapter (REAL RUN - will insert)..."
RESULT=$(curl -s "$BASE/functions/v1/fetch-news-events?brand_id=$BRAND" \
  -H "Authorization: Bearer $ANON")
echo "$RESULT" | jq -c '{success, scanned, inserted, skipped}'
INSERTED=$(echo "$RESULT" | jq -r '.inserted')
echo "   → Inserted $INSERTED events"
echo ""

# 3) Re-run once more to confirm dedupe by normalized URL
echo "6️⃣  Testing dedupe (second run - should skip all)..."
RESULT2=$(curl -s "$BASE/functions/v1/fetch-news-events?brand_id=$BRAND" \
  -H "Authorization: Bearer $ANON")
echo "$RESULT2" | jq -c '{success, scanned, inserted, skipped}'
SKIPPED=$(echo "$RESULT2" | jq -r '.skipped')
echo "   → Skipped $SKIPPED duplicates (should be ≈ previous inserted count)"
echo ""

echo "✅ Smoke tests complete!"
echo ""
echo "Next steps:"
echo "  - Check logs for 'Timeout' or '(X fails)' messages (circuit breaker)"
echo "  - Run INTEGRATION_TESTS.sql to verify normalized URLs in DB"
echo "  - Check that event_sources rows were created"
echo "  - Verify coalesced push jobs were enqueued"

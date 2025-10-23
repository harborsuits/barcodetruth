#!/bin/bash
# Enrichment Pipeline Smoke Tests
# Run this script to verify all enrichers are working correctly
# Usage: ./smoke_test_enrichment.sh <BRAND_UUID>

set -e

# Check required commands
command -v jq >/dev/null || { echo "ERROR: jq required (brew install jq)"; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl required"; exit 1; }

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-https://midmvcwtywnexzdwbekp.supabase.co}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?ERROR: Set SUPABASE_SERVICE_ROLE_KEY}"

# Test brand (required argument)
TEST_BRAND_ID="${1:?Usage: $0 <BRAND_UUID>}"

echo "================================================"
echo "  Enrichment Pipeline Smoke Tests"
echo "================================================"
echo ""

# Test 1: Brand Wiki (Description + QID)
echo -e "${YELLOW}Test 1: Brand Wiki Enrichment${NC}"
echo "Testing brand ID: $TEST_BRAND_ID"

WIKI_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"brand_id\":\"$TEST_BRAND_ID\"}" \
  "$SUPABASE_URL/functions/v1/enrich-brand-wiki")

echo "$WIKI_RESPONSE" | jq .

if echo "$WIKI_RESPONSE" | jq -e '.wikidata_qid' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Wiki enrichment successful${NC}"
  WIKIDATA_QID=$(echo "$WIKI_RESPONSE" | jq -r '.wikidata_qid')
else
  echo -e "${RED}✗ Wiki enrichment failed or no QID found${NC}"
  WIKIDATA_QID=""
fi

echo ""

# Test 2: Ownership Enrichment
echo -e "${YELLOW}Test 2: Ownership Enrichment${NC}"

OWNERSHIP_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"brand_id\":\"$TEST_BRAND_ID\"}" \
  "$SUPABASE_URL/functions/v1/enrich-ownership")

echo "$OWNERSHIP_RESPONSE" | jq .

if echo "$OWNERSHIP_RESPONSE" | jq -e '.rows_written' > /dev/null 2>&1; then
  ROWS_WRITTEN=$(echo "$OWNERSHIP_RESPONSE" | jq -r '.rows_written')
  if [ "$ROWS_WRITTEN" -gt 0 ]; then
    echo -e "${GREEN}✓ Ownership enrichment successful ($ROWS_WRITTEN rows)${NC}"
  else
    echo -e "${YELLOW}⚠ Ownership enrichment returned 0 rows${NC}"
  fi
else
  echo -e "${RED}✗ Ownership enrichment failed${NC}"
fi

echo ""

# Test 3: Key People Enrichment (if QID found)
if [ -n "$WIKIDATA_QID" ]; then
  echo -e "${YELLOW}Test 3: Key People Enrichment${NC}"
  
  # Get parent company ID from database (placeholder - requires DB access)
  echo "Note: Requires parent company_id from database"
  echo "Manual test: curl -X POST -H \"Authorization: Bearer \$SERVICE_KEY\" \\"
  echo "  -d '{\"company_id\":\"COMPANY_UUID\",\"wikidata_qid\":\"$WIKIDATA_QID\"}' \\"
  echo "  $SUPABASE_URL/functions/v1/enrich-key-people"
else
  echo -e "${YELLOW}Skipping Test 3 (Key People) - no QID available${NC}"
fi

echo ""

# Test 4: Shareholders DEV Seed
echo -e "${YELLOW}Test 4: Shareholders DEV Seed${NC}"

# Export DEV seed mode
export ENRICH_SHAREHOLDERS_DEV_SEED=1

echo "Note: Requires parent company_id from database"
echo "Manual test: export ENRICH_SHAREHOLDERS_DEV_SEED=1"
echo "curl -X POST -H \"Authorization: Bearer \$SERVICE_KEY\" \\"
echo "  -d '{\"company_id\":\"COMPANY_UUID\",\"ticker\":\"TEST\"}' \\"
echo "  $SUPABASE_URL/functions/v1/enrich-shareholders"

echo ""
echo "================================================"
echo "  Smoke Tests Complete"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Verify data in database using queries from SHIP_READINESS_CHECKLIST.md"
echo "2. Check admin monitor at /admin/enrichment-monitor"
echo "3. Run validation SQL from docs/ENRICHMENT_VALIDATION.sql"

#!/bin/bash
# TICKET B: Scan API acceptance test script

set -e

PROJECT_URL="https://midmvcwtywnexzdwbekp.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"

echo "=== TICKET B: Scan API Tests ==="
echo ""

echo "Test 1: Valid UPC (should return 200 with product data)"
curl -s -X POST "${PROJECT_URL}/functions/v1/scan-product" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"upc":"049000000009"}' | jq '.'

echo ""
echo "Test 2: Unknown UPC (should return 404)"
curl -s -X POST "${PROJECT_URL}/functions/v1/scan-product" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"upc":"999999999999"}' | jq '.'

echo ""
echo "Test 3: Invalid UPC format (should return 400)"
curl -s -X POST "${PROJECT_URL}/functions/v1/scan-product" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"upc":"abc"}' | jq '.'

echo ""
echo "Test 4: UPC normalization (spaces/hyphens, should return 200)"
curl -s -X POST "${PROJECT_URL}/functions/v1/scan-product" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"upc":"049-000-000-009"}' | jq '.'

echo ""
echo "=== All tests complete ==="

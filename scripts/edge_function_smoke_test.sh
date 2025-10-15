#!/bin/bash
# Edge Function Smoke Tests
# Usage: ./edge_function_smoke_test.sh <your-project-url>

API_BASE="${1:-https://midmvcwtywnexzdwbekp.supabase.co/functions/v1}"
BRAND_ID="4965edf9-68f3-4465-88d1-168bc6cc189a"  # Unilever

echo "Testing Edge Functions at: $API_BASE"
echo "============================================"

# Test 1: Trending endpoint
echo -e "\n1. Testing /trending endpoint..."
TRENDING_RESULT=$(curl -s "$API_BASE/v1-brands/trending?limit=10")
TRENDING_COUNT=$(echo "$TRENDING_RESULT" | jq 'length' 2>/dev/null || echo "ERROR")

if [ "$TRENDING_COUNT" != "ERROR" ] && [ "$TRENDING_COUNT" -gt 0 ]; then
  echo "✓ Trending: $TRENDING_COUNT brands returned"
  echo "$TRENDING_RESULT" | jq '.[0] | {name, trend_score, last_event_at, events_30d}'
else
  echo "✗ Trending failed or returned no results"
  echo "$TRENDING_RESULT"
fi

# Test 2: Search endpoint
echo -e "\n2. Testing /search endpoint..."
SEARCH_RESULT=$(curl -s "$API_BASE/v1-brands/search?q=Unilever")
BRANDS_COUNT=$(echo "$SEARCH_RESULT" | jq '.brands | length' 2>/dev/null || echo "ERROR")
PRODUCTS_COUNT=$(echo "$SEARCH_RESULT" | jq '.products | length' 2>/dev/null || echo "ERROR")

if [ "$BRANDS_COUNT" != "ERROR" ]; then
  echo "✓ Search: $BRANDS_COUNT brands, $PRODUCTS_COUNT products found"
  echo "$SEARCH_RESULT" | jq '{brands: (.brands | length), products: (.products | length)}'
else
  echo "✗ Search failed"
  echo "$SEARCH_RESULT"
fi

# Test 3: Brand detail endpoint
echo -e "\n3. Testing /brands/:id endpoint..."
BRAND_RESULT=$(curl -s "$API_BASE/v1-brands/brands/$BRAND_ID")
BRAND_NAME=$(echo "$BRAND_RESULT" | jq -r '.name' 2>/dev/null || echo "ERROR")
EVIDENCE_COUNT=$(echo "$BRAND_RESULT" | jq '.evidence | length' 2>/dev/null || echo "0")

if [ "$BRAND_NAME" != "ERROR" ] && [ "$BRAND_NAME" != "null" ]; then
  echo "✓ Brand detail: $BRAND_NAME"
  echo "$BRAND_RESULT" | jq '{name, score, last_event_at, evidence_count: (.evidence | length), has_summary: (.ai_summary_md != null)}'
else
  echo "✗ Brand detail failed"
  echo "$BRAND_RESULT"
fi

# Test 4: Evidence links validation
echo -e "\n4. Validating evidence links..."
if [ "$EVIDENCE_COUNT" -gt 0 ]; then
  FIRST_URL=$(echo "$BRAND_RESULT" | jq -r '.evidence[0].url' 2>/dev/null)
  if [[ "$FIRST_URL" =~ ^https?:// ]]; then
    echo "✓ Evidence has valid HTTP(S) URLs"
    echo "  Sample: $FIRST_URL"
  else
    echo "✗ Evidence URLs are invalid"
    echo "  Found: $FIRST_URL"
  fi
else
  echo "⚠ No evidence found for this brand"
fi

echo -e "\n============================================"
echo "Smoke tests complete!"

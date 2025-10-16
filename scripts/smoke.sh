#!/usr/bin/env bash
# CI smoke tests - verify real-only enforcement
set -euo pipefail

API="${SUPABASE_URL}/functions/v1/v1-brands"
TEST_BRAND_ID="${TEST_BRAND_ID:-4965edf9-68f3-4465-88d1-168bc6cc189a}" # Unilever

echo "🧪 Starting smoke tests..."

# Test 1: Trending endpoint
echo "[1/4] Testing /trending endpoint..."
TRENDING=$(curl -sf "${API}/trending?limit=10" || echo "FAIL")
if [[ "$TRENDING" == "FAIL" ]]; then
  echo "❌ Trending endpoint failed"
  exit 1
fi
echo "✓ Trending OK"

# Test 2: Search endpoint
echo "[2/4] Testing /search endpoint..."
SEARCH=$(curl -sf "${API}/search?q=Unilever" || echo "FAIL")
if [[ "$SEARCH" == "FAIL" ]]; then
  echo "❌ Search endpoint failed"
  exit 1
fi
BRAND_COUNT=$(echo "$SEARCH" | jq -e '.brands | type=="array"' || echo "FAIL")
if [[ "$BRAND_COUNT" == "FAIL" ]]; then
  echo "❌ Search response malformed"
  exit 1
fi
echo "✓ Search OK"

# Test 3: Brand detail real-only gate
echo "[3/4] Testing /brands/:id real-only enforcement..."
RESP=$(curl -sf "${API}/brands/${TEST_BRAND_ID}" || echo "FAIL")
if [[ "$RESP" == "FAIL" ]]; then
  echo "❌ Brand endpoint failed"
  exit 1
fi

HAS_EVENT=$(echo "$RESP" | jq -r '._real_only.hasEvent')
HAS_EVID=$(echo "$RESP" | jq -r '._real_only.hasEvidence')
SCORE=$(echo "$RESP" | jq -r '.score')
SUMMARY=$(echo "$RESP" | jq -r '.ai_summary_md')

# Gate enforcement logic
if [[ "$HAS_EVENT" == "true" && "$HAS_EVID" == "true" ]]; then
  # Verified brand - score/summary should be present
  if [[ "$SCORE" == "null" ]]; then
    echo "❌ LEAK: Verified brand missing score"
    exit 1
  fi
  echo "✓ Verified brand correctly shows score"
else
  # Unverified brand - score/summary must be null
  if [[ "$SCORE" != "null" ]]; then
    echo "❌ LEAK: Unverified brand showing score: $SCORE"
    echo "Debug: hasEvent=$HAS_EVENT, hasEvidence=$HAS_EVID"
    exit 1
  fi
  if [[ "$SUMMARY" != "null" ]]; then
    echo "❌ LEAK: Unverified brand showing summary"
    exit 1
  fi
  echo "✓ Unverified brand correctly gated"
fi

# Test 4: Evidence URLs are real HTTP(S)
echo "[4/4] Testing evidence URL validity..."
EVIDENCE=$(echo "$RESP" | jq -r '.evidence[]?.url // empty')
if [[ -n "$EVIDENCE" ]]; then
  while IFS= read -r url; do
    if [[ ! "$url" =~ ^https?:// ]]; then
      echo "❌ Invalid evidence URL: $url"
      exit 1
    fi
  done <<< "$EVIDENCE"
  echo "✓ Evidence URLs valid"
else
  echo "⚠ No evidence to validate (brand may be unverified)"
fi

echo ""
echo "✅ All smoke tests passed!"
echo "Real-only enforcement verified ✓"

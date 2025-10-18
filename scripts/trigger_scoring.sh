#!/bin/bash
# Manually trigger scoring for brands with events but no scores

PROJECT_URL="https://midmvcwtywnexzdwbekp.supabase.co"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-YOUR_SERVICE_ROLE_KEY}"

echo "=== Triggering Score Calculation ==="
echo ""

# Starbucks (39 events)
echo "Calculating score for Starbucks..."
curl -X GET "${PROJECT_URL}/functions/v1/calculate-brand-score?brand_id=28dd162b-6e55-49ae-be8a-e8e8fc4b0066" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" | jq '.'

echo ""

# Columbia Sportswear (16 events)  
echo "Calculating score for Columbia Sportswear..."
curl -X GET "${PROJECT_URL}/functions/v1/calculate-brand-score?brand_id=39f509c0-ef74-4848-abb5-d60942695f6b" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" | jq '.'

echo ""

# Unilever (25 events)
echo "Calculating score for Unilever..."
curl -X GET "${PROJECT_URL}/functions/v1/calculate-brand-score?brand_id=4965edf9-68f3-4465-88d1-168bc6cc189a" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "=== Complete ==="

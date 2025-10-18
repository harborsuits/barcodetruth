#!/bin/bash

# Trigger the simple brand scorer to calculate real scores

PROJECT_ID="midmvcwtywnexzdwbekp"
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"

echo "🎯 Triggering simple-brand-scorer to calculate real scores..."
echo ""

# Note: This requires SERVICE_ROLE_KEY which you have in your environment
# Get it from your Supabase dashboard: Settings > API > service_role key

curl -X GET "${SUPABASE_URL}/functions/v1/simple-brand-scorer" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json"

echo ""
echo ""
echo "✅ Scoring triggered!"
echo ""
echo "To verify scores were calculated, run:"
echo "SELECT name, score, breakdown FROM brand_scores JOIN brands ON brands.id = brand_scores.brand_id ORDER BY name LIMIT 10;"

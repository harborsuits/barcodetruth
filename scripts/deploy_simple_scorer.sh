#!/bin/bash

# Deploy and test the simple brand scorer
# This replaces the broken complex scoring system with one that actually works

set -e

echo "🚀 Deploying simple-brand-scorer function..."

# Get project details
PROJECT_ID=$(grep 'project_id' supabase/config.toml | cut -d'"' -f2)
SUPABASE_URL="https://${PROJECT_ID}.supabase.co"

echo "📦 Project: ${PROJECT_ID}"

# Note: In Lovable, functions are deployed automatically
# This script is for manual Supabase CLI deployment if needed

echo ""
echo "✅ Function will be deployed automatically by Lovable"
echo ""
echo "To test manually:"
echo "curl -X GET \"${SUPABASE_URL}/functions/v1/simple-brand-scorer\" \\"
echo "  -H \"Authorization: Bearer YOUR_SERVICE_ROLE_KEY\""
echo ""
echo "Expected result:"
echo "{\"success\":true,\"processed\":75,\"succeeded\":75,\"failed\":0}"
echo ""
echo "To verify scores were created:"
echo "SELECT COUNT(*) FROM brand_scores;"
echo "SELECT b.name, bs.score, bs.breakdown FROM brands b"
echo "JOIN brand_scores bs ON bs.brand_id = b.id"
echo "ORDER BY bs.score DESC LIMIT 10;"

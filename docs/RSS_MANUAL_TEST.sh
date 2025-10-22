#!/bin/bash
# RSS Integration Manual Testing Script
# Run this to manually seed a few brands with RSS data

# Set these environment variables first:
# export SUPABASE_URL="https://midmvcwtywnexzdwbekp.supabase.co"
# export SERVICE_ROLE_KEY="your-service-role-key"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_URL and SERVICE_ROLE_KEY must be set"
  exit 1
fi

# Brand IDs
KROGER_ID="5e7f728b-d485-43ce-b82e-ed7c606f01d2"
WALMART_ID="5b465261-bca1-41c1-9929-5ee3a8ceea61"
TARGET_ID="a23f7317-61db-40db-9ea3-f9eb22f8bfb8"

echo "Testing RSS integration with 3 brands..."
echo ""

# Test Kroger
echo "=== Testing Kroger ==="
echo "Google News..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-google-news-rss?brand_id=$KROGER_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "Reddit..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-reddit-rss?brand_id=$KROGER_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "SEC EDGAR..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-sec-edgar?brand_id=$KROGER_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "=== Testing Walmart ==="
echo "Google News..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-google-news-rss?brand_id=$WALMART_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "Reddit..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-reddit-rss?brand_id=$WALMART_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "SEC EDGAR..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-sec-edgar?brand_id=$WALMART_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "=== Testing Target ==="
echo "Google News..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-google-news-rss?brand_id=$TARGET_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "Reddit..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-reddit-rss?brand_id=$TARGET_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "SEC EDGAR..."
curl -X POST "$SUPABASE_URL/functions/v1/fetch-sec-edgar?brand_id=$TARGET_ID" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -s | jq '.'

echo ""
echo "=== Testing complete! ==="
echo "Check /admin/rss-monitor to see the results"

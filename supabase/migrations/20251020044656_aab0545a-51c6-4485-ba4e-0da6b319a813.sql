
-- Add per-brand API tracking and fair rotation
CREATE TABLE IF NOT EXISTS brand_api_usage (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('day', now()),
  calls_today INT NOT NULL DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to get next brand for ingestion (round-robin with quota limits)
CREATE OR REPLACE FUNCTION get_next_brands_fair_rotation(p_limit INT DEFAULT 10)
RETURNS TABLE(brand_id UUID, brand_name TEXT, company_size TEXT) 
LANGUAGE SQL
STABLE
AS $$
  WITH current_window AS (
    SELECT date_trunc('day', now()) AS window_start
  ),
  -- Calculate max calls per brand tier
  tier_limits AS (
    SELECT 'fortune_500' AS tier, 100 AS max_calls_per_brand
    UNION ALL SELECT 'large', 50
    UNION ALL SELECT 'medium', 20
  ),
  -- Get brands that haven't hit their quota
  eligible_brands AS (
    SELECT 
      b.id,
      b.name,
      b.company_size,
      COALESCE(u.calls_today, 0) AS calls_today,
      tl.max_calls_per_brand,
      COALESCE(b.last_news_ingestion, '2000-01-01'::timestamptz) AS last_ingestion,
      ROW_NUMBER() OVER (
        PARTITION BY b.company_size 
        ORDER BY COALESCE(b.last_news_ingestion, '2000-01-01'::timestamptz) ASC
      ) AS tier_priority
    FROM brands b
    CROSS JOIN current_window cw
    LEFT JOIN brand_api_usage u ON u.brand_id = b.id AND u.window_start = cw.window_start
    LEFT JOIN tier_limits tl ON tl.tier = b.company_size
    WHERE b.is_active = true 
      AND b.is_test = false
      AND COALESCE(u.calls_today, 0) < tl.max_calls_per_brand
  ),
  -- Round-robin across tiers
  interleaved AS (
    SELECT id, name, company_size,
      ROW_NUMBER() OVER (ORDER BY tier_priority, last_ingestion) AS row_num
    FROM eligible_brands
  )
  SELECT id, name, company_size
  FROM interleaved
  ORDER BY row_num
  LIMIT p_limit;
$$;

-- Function to increment brand API usage
CREATE OR REPLACE FUNCTION increment_brand_api_usage(p_brand_id UUID, p_calls INT DEFAULT 1)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('day', now());
BEGIN
  INSERT INTO brand_api_usage (brand_id, window_start, calls_today, last_call_at, updated_at)
  VALUES (p_brand_id, v_window, p_calls, now(), now())
  ON CONFLICT (brand_id)
  DO UPDATE SET
    window_start = CASE 
      WHEN brand_api_usage.window_start < v_window THEN v_window 
      ELSE brand_api_usage.window_start 
    END,
    calls_today = CASE 
      WHEN brand_api_usage.window_start < v_window THEN p_calls
      ELSE brand_api_usage.calls_today + p_calls
    END,
    last_call_at = now(),
    updated_at = now();
END;
$$;

-- Grant permissions
GRANT SELECT ON brand_api_usage TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_next_brands_fair_rotation TO service_role;
GRANT EXECUTE ON FUNCTION increment_brand_api_usage TO service_role;

COMMENT ON TABLE brand_api_usage IS 'Tracks API usage per brand per day to ensure fair distribution';
COMMENT ON FUNCTION get_next_brands_fair_rotation IS 'Returns next brands to process using fair round-robin rotation with quota limits';


-- Create enum for confidence levels (check if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_confidence') THEN
        CREATE TYPE data_confidence AS ENUM ('none', 'low', 'medium', 'high');
    END IF;
END $$;

-- Function to calculate brand data confidence
CREATE OR REPLACE FUNCTION get_brand_data_confidence(p_brand_id UUID)
RETURNS TABLE(
  confidence_level data_confidence,
  categories_covered INTEGER,
  completeness_percent INTEGER,
  has_significant_events BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_event_count INTEGER;
  v_categories_covered INTEGER;
  v_verified_rate NUMERIC;
  v_has_significant BOOLEAN;
BEGIN
  -- Get basic metrics from brand_data_coverage
  SELECT COALESCE(events_30d, 0), COALESCE(verified_rate, 0)
  INTO v_event_count, v_verified_rate
  FROM brand_data_coverage
  WHERE brand_id = p_brand_id;

  -- Count unique significant categories (excluding 'general')
  SELECT 
    COUNT(DISTINCT category),
    COUNT(*) > 0
  INTO v_categories_covered, v_has_significant
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND event_date >= NOW() - INTERVAL '365 days'
    AND category_code IS NOT NULL
    AND category_code != 'general'
    AND is_irrelevant = false;

  -- Calculate completeness percentage
  completeness_percent := CASE 
    WHEN v_event_count >= 20 THEN 100
    WHEN v_event_count >= 10 THEN 50
    WHEN v_event_count >= 5 THEN 25
    ELSE LEAST(100, (v_event_count::numeric / 20.0 * 100)::integer)
  END;

  -- Determine confidence level
  IF v_event_count >= 20 AND v_categories_covered >= 3 AND v_verified_rate >= 0.3 THEN
    confidence_level := 'high'::data_confidence;
  ELSIF v_event_count >= 10 AND v_categories_covered >= 2 THEN
    confidence_level := 'medium'::data_confidence;
  ELSIF v_event_count >= 5 THEN
    confidence_level := 'low'::data_confidence;
  ELSE
    confidence_level := 'none'::data_confidence;
  END IF;

  categories_covered := v_categories_covered;
  has_significant_events := v_has_significant;
  
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION get_brand_data_confidence(UUID) TO authenticated, anon;

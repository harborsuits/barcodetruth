-- Add category_code column to brand_events table
ALTER TABLE public.brand_events 
ADD COLUMN IF NOT EXISTS category_code text,
ADD COLUMN IF NOT EXISTS category_score integer;

-- Add index for faster category queries
CREATE INDEX IF NOT EXISTS idx_brand_events_category_code 
ON public.brand_events(category_code);

-- Update the reclassify_all_events function to use category_code
CREATE OR REPLACE FUNCTION public.reclassify_all_events()
RETURNS TABLE(
  updated_count integer,
  financial_count integer,
  recall_count integer,
  legal_count integer,
  regulatory_count integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_financial_count INTEGER := 0;
  v_recall_count INTEGER := 0;
  v_legal_count INTEGER := 0;
  v_regulatory_count INTEGER := 0;
  v_event RECORD;
  v_result RECORD;
BEGIN
  -- Loop through all events that need reclassification
  FOR v_event IN 
    SELECT event_id, title, description, source_url
    FROM brand_events
    WHERE event_date > NOW() - INTERVAL '90 days'
      AND (category_code IS NULL OR category_code = 'NOISE.GENERAL' OR category_code = 'general')
  LOOP
    -- Get the categorization result
    SELECT * INTO v_result
    FROM test_article_categorization(
      COALESCE(split_part(split_part(v_event.source_url, '/', 3), '?', 1), ''),
      COALESCE(regexp_replace(v_event.source_url, '^https?://[^/]+', ''), ''),
      v_event.title,
      COALESCE(v_event.description, '')
    );
    
    -- Update the event if we got a match
    IF v_result.category_code IS NOT NULL THEN
      UPDATE brand_events
      SET category_code = v_result.category_code,
          updated_at = NOW()
      WHERE event_id = v_event.event_id;
      
      v_updated_count := v_updated_count + 1;
      
      -- Track category counts
      IF v_result.category_code LIKE 'FIN.%' THEN
        v_financial_count := v_financial_count + 1;
      ELSIF v_result.category_code LIKE 'PRODUCT.%' THEN
        v_recall_count := v_recall_count + 1;
      ELSIF v_result.category_code LIKE 'LEGAL.%' THEN
        v_legal_count := v_legal_count + 1;
      ELSIF v_result.category_code LIKE 'REGULATORY.%' THEN
        v_regulatory_count := v_regulatory_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_updated_count,
    v_financial_count,
    v_recall_count,
    v_legal_count,
    v_regulatory_count;
END;
$$;
-- Create RPC to determine brand profile state
-- Returns one of: 'assessable', 'building', 'needs_review'
-- Based on: identity_confidence, dimensions with evidence, name mismatch detection

CREATE OR REPLACE FUNCTION public.get_brand_profile_state(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand RECORD;
  v_confidence_data RECORD;
  v_dimensions_with_evidence INT := 0;
  v_total_events INT := 0;
  v_domains_covered INT := 0;
  v_state TEXT := 'building';
  v_name_mismatch BOOLEAN := false;
  v_mismatch_details JSONB := '[]'::jsonb;
  v_progress JSONB;
  v_last_event_at TIMESTAMPTZ;
BEGIN
  -- Get brand basic info
  SELECT 
    id, name, slug, description, logo_url, website, wikidata_qid,
    parent_company, identity_confidence, enrichment_stage, status,
    created_at
  INTO v_brand
  FROM brands
  WHERE id = p_brand_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  -- Check for name mismatch in description
  IF v_brand.description IS NOT NULL AND v_brand.name IS NOT NULL THEN
    -- Simple heuristic: if description's first sentence doesn't contain brand name
    -- and contains a different capitalized word that looks like a name
    DECLARE
      first_sentence TEXT;
      name_lower TEXT := lower(v_brand.name);
    BEGIN
      first_sentence := split_part(v_brand.description, '.', 1);
      IF length(first_sentence) > 10 AND 
         position(name_lower in lower(first_sentence)) = 0 THEN
        -- Possible mismatch - flag for review
        v_name_mismatch := true;
        v_mismatch_details := jsonb_build_array(
          jsonb_build_object(
            'type', 'name_not_in_description',
            'expected', v_brand.name,
            'description_excerpt', left(first_sentence, 100)
          )
        );
      END IF;
    END;
  END IF;

  -- Get confidence pivot data (dimensions with evidence)
  SELECT 
    COALESCE((CASE WHEN labor_confidence IN ('high', 'medium') THEN 1 ELSE 0 END), 0) +
    COALESCE((CASE WHEN environment_confidence IN ('high', 'medium') THEN 1 ELSE 0 END), 0) +
    COALESCE((CASE WHEN politics_confidence IN ('high', 'medium') THEN 1 ELSE 0 END), 0) +
    COALESCE((CASE WHEN social_confidence IN ('high', 'medium') THEN 1 ELSE 0 END), 0) AS dims_covered
  INTO v_dimensions_with_evidence
  FROM v_brand_confidence_pivot
  WHERE brand_id = p_brand_id;

  v_dimensions_with_evidence := COALESCE(v_dimensions_with_evidence, 0);

  -- Count total relevant events and get last event date
  SELECT 
    COUNT(*),
    MAX(event_date)
  INTO v_total_events, v_last_event_at
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND is_irrelevant = false
    AND is_test = false;

  -- Calculate domain coverage (simplified: count distinct categories as proxy for domains)
  SELECT COUNT(DISTINCT category)
  INTO v_domains_covered
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND is_irrelevant = false
    AND is_test = false;

  -- Determine state
  -- State C: Needs Review - low identity confidence or name mismatch
  IF v_brand.identity_confidence = 'low' OR v_name_mismatch THEN
    v_state := 'needs_review';
  -- State A: Assessable - high/medium confidence + 3+ dimensions with evidence
  ELSIF v_brand.identity_confidence IN ('high', 'medium') AND v_dimensions_with_evidence >= 3 THEN
    v_state := 'assessable';
  -- State B: Building - everything else (actively gathering data)
  ELSE
    v_state := 'building';
  END IF;

  -- Build progress object for Building state
  v_progress := jsonb_build_object(
    'total_events', v_total_events,
    'dimensions_covered', v_dimensions_with_evidence,
    'domains_covered', v_domains_covered,
    'has_description', v_brand.description IS NOT NULL,
    'has_logo', v_brand.logo_url IS NOT NULL,
    'has_website', v_brand.website IS NOT NULL,
    'has_wikidata', v_brand.wikidata_qid IS NOT NULL,
    'enrichment_stage', v_brand.enrichment_stage,
    'last_event_at', v_last_event_at
  );

  RETURN jsonb_build_object(
    'state', v_state,
    'brand_id', p_brand_id,
    'brand_name', v_brand.name,
    'brand_slug', v_brand.slug,
    'identity_confidence', v_brand.identity_confidence,
    'dimensions_with_evidence', v_dimensions_with_evidence,
    'name_mismatch', v_name_mismatch,
    'mismatch_details', v_mismatch_details,
    'progress', v_progress,
    'created_at', v_brand.created_at
  );
END;
$$;

-- Grant execute to authenticated and anon users (public brand info)
GRANT EXECUTE ON FUNCTION public.get_brand_profile_state(UUID) TO authenticated, anon;
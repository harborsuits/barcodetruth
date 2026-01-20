-- Part 1: Create brand_identity_candidates table for storing potential entity matches
CREATE TABLE IF NOT EXISTS public.brand_identity_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  candidate_qid TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_domain TEXT,
  score NUMERIC(4,2) NOT NULL DEFAULT 0,
  reasons JSONB DEFAULT '[]',
  source TEXT DEFAULT 'wikidata',
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, candidate_qid)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_identity_candidates_brand ON public.brand_identity_candidates(brand_id);
CREATE INDEX IF NOT EXISTS idx_identity_candidates_score ON public.brand_identity_candidates(score DESC);
CREATE INDEX IF NOT EXISTS idx_identity_candidates_selected ON public.brand_identity_candidates(brand_id) WHERE is_selected = true;

-- Enable RLS
ALTER TABLE public.brand_identity_candidates ENABLE ROW LEVEL SECURITY;

-- Public read access (candidates are not sensitive)
CREATE POLICY "Anyone can view identity candidates"
  ON public.brand_identity_candidates FOR SELECT
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can manage candidates"
  ON public.brand_identity_candidates FOR ALL
  USING (auth.role() = 'service_role');

-- Part 2: Batch fix - Promote brands that are actually fine
-- Brands where description starts with brand name, has valid wikidata_qid, status = ready
UPDATE public.brands
SET identity_confidence = 'medium',
    identity_notes = 'Auto-promoted: description matches brand name, wikidata valid, status ready'
WHERE identity_confidence = 'low'
  AND status = 'ready'
  AND wikidata_qid IS NOT NULL
  AND description IS NOT NULL
  AND position(lower(name) in lower(split_part(description, '.', 1))) > 0;

-- Part 3: Update get_brand_profile_state to require 2+ mismatch signals
CREATE OR REPLACE FUNCTION public.get_brand_profile_state(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand RECORD;
  v_state TEXT;
  v_event_count INT;
  v_dimensions_with_evidence INT;
  v_domains_covered INT;
  v_name_mismatch BOOLEAN := false;
  v_domain_mismatch BOOLEAN := false;
  v_mismatch_details JSONB := '[]'::JSONB;
  v_mismatch_score INT := 0;
  v_progress JSONB;
  v_last_event_at TIMESTAMPTZ;
BEGIN
  -- Fetch brand
  SELECT * INTO v_brand FROM brands WHERE id = p_brand_id;
  
  IF v_brand IS NULL THEN
    RETURN jsonb_build_object('state', 'not_found', 'brand_id', p_brand_id);
  END IF;
  
  -- Count real events (non-test, non-irrelevant)
  SELECT COUNT(*) INTO v_event_count
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND is_test = false
    AND (is_irrelevant IS NULL OR is_irrelevant = false);
  
  -- Get last event timestamp
  SELECT MAX(created_at) INTO v_last_event_at
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND is_test = false
    AND (is_irrelevant IS NULL OR is_irrelevant = false);
  
  -- Count dimensions with evidence (events that have non-zero impacts)
  SELECT COUNT(DISTINCT category) INTO v_dimensions_with_evidence
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND is_test = false
    AND (is_irrelevant IS NULL OR is_irrelevant = false)
    AND category IS NOT NULL;
  
  -- Count unique source domains
  SELECT COUNT(DISTINCT 
    CASE 
      WHEN source_url IS NOT NULL THEN 
        substring(source_url from 'https?://([^/]+)')
      ELSE NULL 
    END
  ) INTO v_domains_covered
  FROM brand_events
  WHERE brand_id = p_brand_id
    AND is_test = false
    AND source_url IS NOT NULL;
  
  -- Check for name mismatch: brand name not in first sentence of description
  IF v_brand.description IS NOT NULL AND length(v_brand.description) > 0 THEN
    v_name_mismatch := position(lower(v_brand.name) in lower(split_part(v_brand.description, '.', 1))) = 0;
    
    IF v_name_mismatch THEN
      v_mismatch_details := v_mismatch_details || jsonb_build_object(
        'type', 'name_not_in_description',
        'expected', v_brand.name,
        'description_excerpt', left(v_brand.description, 200)
      );
    END IF;
  END IF;
  
  -- Calculate mismatch score (require 2+ signals for needs_review)
  -- Weight 1: identity_confidence = 'low'
  IF v_brand.identity_confidence = 'low' THEN
    v_mismatch_score := v_mismatch_score + 1;
  END IF;
  
  -- Weight 1: Name not in description
  IF v_name_mismatch THEN
    v_mismatch_score := v_mismatch_score + 1;
  END IF;
  
  -- Weight 2: Status = 'failed' (instant trigger)
  IF v_brand.status = 'failed' THEN
    v_mismatch_score := v_mismatch_score + 2;
  END IF;
  
  -- Build progress object
  v_progress := jsonb_build_object(
    'total_events', v_event_count,
    'dimensions_covered', v_dimensions_with_evidence,
    'domains_covered', v_domains_covered,
    'has_description', v_brand.description IS NOT NULL AND length(v_brand.description) > 10,
    'has_logo', v_brand.logo_url IS NOT NULL,
    'has_website', v_brand.website IS NOT NULL,
    'has_wikidata', v_brand.wikidata_qid IS NOT NULL,
    'enrichment_stage', v_brand.enrichment_stage,
    'last_event_at', v_last_event_at
  );
  
  -- Determine state based on mismatch score (require 2+ for needs_review)
  IF v_mismatch_score >= 2 THEN
    v_state := 'needs_review';
  ELSIF v_brand.status IN ('stub', 'building') OR v_brand.enrichment_stage IS NOT NULL THEN
    v_state := 'building';
  ELSIF v_event_count >= 3 AND v_dimensions_with_evidence >= 2 THEN
    v_state := 'assessable';
  ELSE
    v_state := 'building';
  END IF;
  
  RETURN jsonb_build_object(
    'state', v_state,
    'brand_id', v_brand.id,
    'brand_name', v_brand.name,
    'brand_slug', v_brand.slug,
    'identity_confidence', v_brand.identity_confidence,
    'dimensions_with_evidence', v_dimensions_with_evidence,
    'name_mismatch', v_name_mismatch,
    'mismatch_details', v_mismatch_details,
    'mismatch_score', v_mismatch_score,
    'progress', v_progress,
    'created_at', v_brand.created_at
  );
END;
$$;
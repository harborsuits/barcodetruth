
-- Add company_type enum and column to companies
DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM ('conglomerate', 'public', 'private', 'independent', 'local', 'cooperative', 'nonprofit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_type public.company_type DEFAULT NULL;

-- Create index for alternatives filtering
CREATE INDEX IF NOT EXISTS idx_companies_company_type ON public.companies(company_type) WHERE company_type IS NOT NULL;

-- Create the smart alternatives RPC
CREATE OR REPLACE FUNCTION public.get_smart_alternatives(
  p_brand_id uuid,
  p_limit int DEFAULT 12
)
RETURNS TABLE(
  brand_id uuid,
  brand_name text,
  parent_company text,
  logo_url text,
  reason text,
  score numeric,
  score_environment numeric,
  score_labor numeric,
  score_politics numeric,
  score_social numeric,
  company_type text,
  alt_group text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
AS $$
DECLARE
  v_category text;
  v_company_id uuid;
  v_parent_company text;
BEGIN
  -- Get the scanned brand's category and parent company
  SELECT b.category_slug, b.parent_company_id, b.parent_company
  INTO v_category, v_company_id, v_parent_company
  FROM brands b
  WHERE b.id = p_brand_id;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      b.id AS bid,
      b.name AS bname,
      b.parent_company AS bparent,
      b.logo_url AS blogo,
      b.parent_company_id AS bcompany_id,
      bs.score_environment,
      bs.score_labor,
      bs.score_politics,
      bs.score_social,
      bs.composite_score,
      c.company_type AS ctype,
      -- Independence score: independent/local/coop > private > public > conglomerate
      CASE c.company_type
        WHEN 'independent' THEN 40
        WHEN 'local' THEN 40
        WHEN 'cooperative' THEN 40
        WHEN 'nonprofit' THEN 35
        WHEN 'private' THEN 20
        WHEN 'public' THEN 10
        WHEN 'conglomerate' THEN 0
        ELSE 15 -- unknown defaults to moderate
      END AS independence_bonus,
      -- Group assignment
      CASE
        WHEN c.company_type IN ('independent', 'local', 'cooperative', 'nonprofit') THEN 'independent'
        WHEN c.company_type = 'local' THEN 'local'
        ELSE 'mainstream'
      END AS group_label
    FROM brands b
    JOIN brand_scores bs ON bs.brand_id = b.id
    LEFT JOIN companies c ON c.id = b.parent_company_id
    WHERE b.is_active = true
      AND b.id != p_brand_id
      -- Exclude same parent company (critical!)
      AND (b.parent_company_id IS NULL OR b.parent_company_id != v_company_id)
      AND (b.parent_company IS NULL OR b.parent_company != v_parent_company)
      -- Same category when available
      AND (v_category IS NULL OR b.category_slug = v_category)
  )
  SELECT
    cd.bid,
    cd.bname,
    cd.bparent,
    cd.blogo,
    CASE
      WHEN cd.ctype IN ('independent', 'local', 'cooperative') THEN 'Independent brand with strong scores'
      WHEN cd.composite_score >= 70 THEN 'Higher overall ethics score'
      WHEN cd.score_environment >= 70 THEN 'Strong environmental record'
      WHEN cd.score_labor >= 70 THEN 'Strong labor practices'
      ELSE 'Category alternative'
    END AS reason,
    -- Final ranking: composite + independence bonus
    ROUND((COALESCE(cd.composite_score, 50) + cd.independence_bonus)::numeric, 1) AS score,
    COALESCE(cd.score_environment, 50)::numeric,
    COALESCE(cd.score_labor, 50)::numeric,
    COALESCE(cd.score_politics, 50)::numeric,
    COALESCE(cd.score_social, 50)::numeric,
    COALESCE(cd.ctype::text, 'unknown'),
    cd.group_label
  FROM candidates cd
  ORDER BY (COALESCE(cd.composite_score, 50) + cd.independence_bonus) DESC
  LIMIT p_limit;
END;
$$;

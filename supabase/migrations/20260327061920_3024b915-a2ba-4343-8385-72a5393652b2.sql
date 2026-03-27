
CREATE OR REPLACE FUNCTION public.get_smart_alternatives(p_brand_id uuid, p_limit integer DEFAULT 12)
 RETURNS TABLE(brand_id uuid, brand_name text, parent_company text, logo_url text, reason text, score numeric, score_environment numeric, score_labor numeric, score_politics numeric, score_social numeric, company_type text, alt_group text)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_category text;
  v_subcategory text;
  v_company_id uuid;
  v_parent_company text;
BEGIN
  SELECT b.category_slug, b.subcategory_slug, b.parent_company_id, b.parent_company
  INTO v_category, v_subcategory, v_company_id, v_parent_company
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
      b.subcategory_slug AS bsubcat,
      bs.score_environment,
      bs.score_labor,
      bs.score_politics,
      bs.score_social,
      bs.composite_score,
      c.company_type AS ctype,
      CASE
        WHEN c.company_type IN ('independent', 'local', 'cooperative', 'nonprofit', 'private') THEN true
        ELSE false
      END AS is_better_eligible,
      CASE c.company_type
        WHEN 'independent' THEN 40
        WHEN 'local' THEN 40
        WHEN 'cooperative' THEN 40
        WHEN 'nonprofit' THEN 35
        WHEN 'private' THEN 20
        WHEN 'public' THEN 10
        WHEN 'conglomerate' THEN 0
        ELSE 15
      END AS independence_bonus,
      CASE
        WHEN v_subcategory IS NOT NULL AND b.subcategory_slug = v_subcategory THEN 25
        WHEN b.category_slug = v_category THEN 10
        ELSE 0
      END AS category_bonus
    FROM brands b
    JOIN brand_scores bs ON bs.brand_id = b.id
    LEFT JOIN companies c ON c.id = b.parent_company_id
    WHERE b.is_active = true
      AND b.id != p_brand_id
      AND (b.parent_company_id IS NULL OR b.parent_company_id != v_company_id)
      AND (b.parent_company IS NULL OR b.parent_company != v_parent_company)
      AND (v_category IS NULL OR b.category_slug = v_category)
  ),
  better_opts AS (
    SELECT cd.*, 'better'::text AS group_label,
      ROW_NUMBER() OVER (ORDER BY cd.category_bonus DESC, (COALESCE(cd.composite_score, 50) + cd.independence_bonus) DESC) AS rn
    FROM candidates cd
    WHERE cd.is_better_eligible = true
  ),
  similar_opts AS (
    SELECT cd.*, 'similar'::text AS group_label,
      ROW_NUMBER() OVER (ORDER BY cd.category_bonus DESC, COALESCE(cd.composite_score, 50) DESC) AS rn
    FROM candidates cd
    WHERE cd.is_better_eligible = false
  ),
  combined AS (
    SELECT * FROM better_opts WHERE rn <= GREATEST(p_limit / 2, 3)
    UNION ALL
    SELECT * FROM similar_opts WHERE rn <= GREATEST(p_limit / 2, 3)
  )
  SELECT
    cd.bid,
    cd.bname,
    cd.bparent,
    cd.blogo,
    CASE
      WHEN cd.group_label = 'better' AND cd.ctype IN ('independent', 'local', 'cooperative') THEN 'Independent brand with strong scores'
      WHEN cd.group_label = 'better' AND cd.composite_score >= 70 THEN 'Higher overall ethics score'
      WHEN cd.group_label = 'better' THEN 'Better option in this category'
      ELSE 'Similar product'
    END AS reason,
    ROUND((COALESCE(cd.composite_score, 50) + cd.independence_bonus + cd.category_bonus)::numeric, 1) AS score,
    COALESCE(cd.score_environment, 50)::numeric,
    COALESCE(cd.score_labor, 50)::numeric,
    COALESCE(cd.score_politics, 50)::numeric,
    COALESCE(cd.score_social, 50)::numeric,
    COALESCE(cd.ctype::text, 'unknown'),
    cd.group_label
  FROM combined cd
  ORDER BY
    CASE cd.group_label WHEN 'better' THEN 0 ELSE 1 END,
    cd.category_bonus DESC,
    (COALESCE(cd.composite_score, 50) + cd.independence_bonus) DESC;
END;
$function$;

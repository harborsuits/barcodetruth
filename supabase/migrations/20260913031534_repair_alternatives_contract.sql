-- Repair the UUID/TEXT join without rewriting stored ownership data.
-- Until ownership and shopper-fit evidence are available, these are research
-- candidates in a known subcategory, never automatically "better" purchases.
CREATE OR REPLACE FUNCTION public.get_smart_alternatives(p_brand_id uuid, p_limit integer DEFAULT 12)
RETURNS TABLE(brand_id uuid, brand_name text, parent_company text, logo_url text,
  reason text, score numeric, score_environment numeric, score_labor numeric,
  score_politics numeric, score_social numeric, company_type text, alt_group text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_category text;
  v_subcategory text;
  v_company_id public.brands.parent_company_id%TYPE;
  v_parent_company text;
BEGIN
  SELECT b.category_slug, b.subcategory_slug, b.parent_company_id, b.parent_company
    INTO v_category, v_subcategory, v_company_id, v_parent_company
    FROM public.brands b WHERE b.id = p_brand_id AND b.is_active = true AND coalesce(b.is_test, false) = false;

  IF nullif(trim(v_category), '') IS NULL OR nullif(trim(v_subcategory), '') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT b.id, b.name::text, b.parent_company::text, b.logo_url::text,
      'Same recorded subcategory; ownership and shopper fit still need review.'::text,
      bs.score::numeric, bs.score_environment::numeric, bs.score_labor::numeric,
      bs.score_politics::numeric, bs.score_social::numeric,
      coalesce(c.company_type::text, 'unknown'), 'candidate'::text
    FROM public.brands b
    LEFT JOIN public.brand_scores bs ON bs.brand_id = b.id
    LEFT JOIN public.companies c ON c.id::text = b.parent_company_id
    WHERE b.id <> p_brand_id AND b.is_active = true AND b.status IN ('ready', 'active')
      AND coalesce(b.is_test, false) = false
      AND b.category_slug = v_category AND b.subcategory_slug = v_subcategory
      AND (nullif(b.parent_company_id, '') IS NULL OR nullif(v_company_id, '') IS NULL OR b.parent_company_id <> v_company_id)
      AND (nullif(trim(b.parent_company), '') IS NULL OR nullif(trim(v_parent_company), '') IS NULL
        OR lower(trim(b.parent_company)) <> lower(trim(v_parent_company)))
    ORDER BY lower(b.name), b.id
    LIMIT greatest(0, least(coalesce(p_limit, 12), 12));
END;
$function$;

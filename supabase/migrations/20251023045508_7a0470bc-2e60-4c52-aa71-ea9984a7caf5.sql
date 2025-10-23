-- Create resolver RPC for consistent company resolution across enrichment and UI
CREATE OR REPLACE FUNCTION public.resolve_company_for_brand(p_brand_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH company_choice AS (
    SELECT co.parent_company_id AS company_id, 1 AS pref
    FROM public.company_ownership co 
    WHERE co.child_brand_id = p_brand_id
    
    UNION ALL
    
    SELECT c.id, 2
    FROM public.brand_data_mappings bdm
    JOIN public.companies c ON c.wikidata_qid = bdm.external_id
    WHERE bdm.brand_id = p_brand_id AND bdm.source = 'wikidata'
    
    UNION ALL
    
    SELECT c2.id, 3
    FROM public.brands b
    JOIN public.companies c2 ON c2.wikidata_qid = b.wikidata_qid
    WHERE b.id = p_brand_id
  )
  SELECT company_id
  FROM company_choice
  WHERE company_id IS NOT NULL
  ORDER BY pref ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_company_for_brand(uuid) TO service_role;
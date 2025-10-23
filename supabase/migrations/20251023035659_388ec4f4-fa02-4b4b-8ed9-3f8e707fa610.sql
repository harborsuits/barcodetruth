
-- Add cron job for daily brand enrichment (using jobname for uniqueness)
SELECT cron.schedule(
  'enrich-brands-daily',
  '0 2 * * *', -- Run at 2 AM daily
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/enrich-all-brands-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Add admin function to check enrichment coverage
CREATE OR REPLACE FUNCTION public.get_enrichment_coverage()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_brands', COUNT(DISTINCT b.id),
    'has_wikidata_qid', COUNT(DISTINCT CASE WHEN b.wikidata_qid IS NOT NULL THEN b.id END),
    'has_company_record', COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN b.id END),
    'has_ownership', COUNT(DISTINCT CASE WHEN co.child_brand_id IS NOT NULL THEN b.id END),
    'has_key_people', COUNT(DISTINCT CASE WHEN cp.company_id IS NOT NULL THEN co.parent_company_id END),
    'has_shareholders', COUNT(DISTINCT CASE WHEN cs.company_id IS NOT NULL THEN co.parent_company_id END),
    'coverage_percent', CASE 
      WHEN COUNT(DISTINCT CASE WHEN b.wikidata_qid IS NOT NULL THEN b.id END) = 0 THEN 0
      ELSE ROUND(
        (COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN b.id END)::numeric / 
         COUNT(DISTINCT CASE WHEN b.wikidata_qid IS NOT NULL THEN b.id END)::numeric) * 100
      )
    END,
    'brands_needing_enrichment', (
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'wikidata_qid', wikidata_qid))
      FROM (
        SELECT b.id, b.name, b.wikidata_qid
        FROM brands b
        LEFT JOIN brand_data_mappings bdm ON b.id = bdm.brand_id AND bdm.source = 'wikidata'
        LEFT JOIN companies c ON bdm.external_id = c.wikidata_qid
        WHERE b.is_active = true 
          AND b.is_test = false
          AND b.wikidata_qid IS NOT NULL
          AND c.id IS NULL
        ORDER BY b.name
        LIMIT 20
      ) needs
    )
  )
  FROM brands b
  LEFT JOIN brand_data_mappings bdm ON b.id = bdm.brand_id AND bdm.source = 'wikidata'
  LEFT JOIN companies c ON bdm.external_id = c.wikidata_qid
  LEFT JOIN company_ownership co ON co.child_brand_id = b.id
  LEFT JOIN company_people cp ON cp.company_id = co.parent_company_id
  LEFT JOIN company_shareholders cs ON cs.company_id = co.parent_company_id
  WHERE b.is_active = true AND b.is_test = false;
$$;

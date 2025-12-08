-- Fix get_shareholder_breakdown to handle NULL percent_owned
CREATE OR REPLACE FUNCTION get_shareholder_breakdown(
  p_brand_id uuid,
  p_max_items int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_id uuid;
  parent_name text;
  top_items jsonb;
  total_count int;
BEGIN
  -- Find parent company for this brand
  SELECT c.id, c.name
  INTO parent_id, parent_name
  FROM company_ownership co
  JOIN companies c ON c.id = co.parent_company_id
  WHERE co.child_brand_id = p_brand_id
  ORDER BY co.confidence DESC
  LIMIT 1;

  IF parent_id IS NULL THEN
    RETURN jsonb_build_object(
      'company_id', NULL,
      'company_name', NULL,
      'items', '[]'::jsonb,
      'others', NULL
    );
  END IF;

  -- Count total shareholders
  SELECT COUNT(*) INTO total_count
  FROM company_shareholders
  WHERE company_id = parent_id;

  IF total_count = 0 THEN
    RETURN jsonb_build_object(
      'company_id', parent_id,
      'company_name', parent_name,
      'items', '[]'::jsonb,
      'others', NULL
    );
  END IF;

  -- Top N holders (handle NULL percent_owned gracefully)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'holder_name', s.holder_name,
        'ownership_percentage', COALESCE(s.percent_owned, 0),
        'holder_wikidata_qid', s.holder_wikidata_qid,
        'approx_brand_slug', b.slug,
        'approx_brand_logo_url', b.logo_url
      )
      ORDER BY COALESCE(s.percent_owned, 0) DESC, s.holder_name
    ),
    '[]'::jsonb
  )
  INTO top_items
  FROM (
    SELECT *
    FROM company_shareholders
    WHERE company_id = parent_id
    ORDER BY COALESCE(percent_owned, 0) DESC, holder_name
    LIMIT p_max_items
  ) s
  LEFT JOIN brands b ON b.wikidata_qid = s.holder_wikidata_qid;

  -- Calculate others count (not percentage since many are null)
  RETURN jsonb_build_object(
    'company_id', parent_id,
    'company_name', parent_name,
    'items', top_items,
    'others', CASE WHEN total_count > p_max_items THEN total_count - p_max_items ELSE NULL END
  );
END;
$$;

-- Create admin health view function
CREATE OR REPLACE FUNCTION get_ingestion_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'events_24h', (SELECT COUNT(*) FROM brand_events WHERE created_at > NOW() - INTERVAL '24 hours' AND is_irrelevant = false),
    'events_7d', (SELECT COUNT(*) FROM brand_events WHERE created_at > NOW() - INTERVAL '7 days' AND is_irrelevant = false),
    'events_30d', (SELECT COUNT(*) FROM brand_events WHERE created_at > NOW() - INTERVAL '30 days' AND is_irrelevant = false),
    'brands_with_events_7d', (SELECT COUNT(DISTINCT brand_id) FROM brand_events WHERE created_at > NOW() - INTERVAL '7 days'),
    'newest_event_age_seconds', (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int FROM brand_events),
    'products_with_barcodes', (SELECT COUNT(*) FROM products WHERE barcode IS NOT NULL),
    'brands_with_parents', (SELECT COUNT(*) FROM company_ownership),
    'brands_with_shareholders', (SELECT COUNT(DISTINCT company_id) FROM company_shareholders),
    'brands_with_key_people', (SELECT COUNT(DISTINCT company_id) FROM company_people),
    'rss_queued', (SELECT COUNT(*) FROM rss_items WHERE status = 'queued'),
    'rss_matched', (SELECT COUNT(*) FROM rss_items WHERE status = 'matched'),
    'rss_rejected', (SELECT COUNT(*) FROM rss_items WHERE status = 'rejected'),
    'last_pull_feeds', (SELECT last_run FROM cron_runs WHERE fn = 'pull-feeds'),
    'last_brand_match', (SELECT last_run FROM cron_runs WHERE fn = 'brand-match')
  );
END;
$$;
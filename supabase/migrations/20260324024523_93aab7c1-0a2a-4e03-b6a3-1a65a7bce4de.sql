
-- Coverage status recompute function
CREATE OR REPLACE FUNCTION public.recompute_brand_coverage_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE brands b
  SET material_event_count_30d = COALESCE(sub.cnt, 0)
  FROM (
    SELECT brand_id, count(*) as cnt
    FROM brand_events
    WHERE score_eligible = true
      AND created_at > now() - interval '30 days'
    GROUP BY brand_id
  ) sub
  WHERE b.id = sub.brand_id;

  UPDATE brands
  SET material_event_count_30d = 0
  WHERE id NOT IN (
    SELECT DISTINCT brand_id FROM brand_events
    WHERE score_eligible = true
      AND created_at > now() - interval '30 days'
  );

  UPDATE brands b
  SET last_material_event_at = sub.latest
  FROM (
    SELECT brand_id, max(created_at) as latest
    FROM brand_events
    WHERE score_eligible = true
    GROUP BY brand_id
  ) sub
  WHERE b.id = sub.brand_id;

  UPDATE brands
  SET last_news_check_at = COALESCE(last_news_check_at, last_news_ingestion)
  WHERE last_news_ingestion IS NOT NULL;

  UPDATE brands SET news_coverage_status = CASE
    WHEN last_news_check_at IS NULL THEN 'never_checked'
    WHEN material_event_count_30d >= 5 AND last_news_check_at > now() - interval '24 hours' THEN 'hot'
    WHEN last_news_check_at > now() - interval '7 days' AND material_event_count_30d > 0 THEN 'active'
    WHEN last_news_check_at > now() - interval '14 days' THEN 'quiet'
    ELSE 'stale'
  END;

  UPDATE brands SET coverage_priority = CASE
    WHEN company_size = 'fortune_500' THEN 1
    WHEN company_size = 'large' THEN 2
    WHEN news_coverage_status = 'never_checked' THEN 1
    WHEN news_coverage_status = 'stale' THEN 2
    WHEN news_coverage_status = 'quiet' THEN 3
    WHEN news_coverage_status = 'active' THEN 4
    WHEN news_coverage_status = 'hot' THEN 5
    ELSE 3
  END;
END;
$$;

-- Admin coverage metrics
CREATE OR REPLACE FUNCTION public.get_coverage_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_active_brands', (SELECT count(*) FROM brands WHERE is_active = true),
    'checked_24h', (SELECT count(*) FROM brands WHERE last_news_check_at > now() - interval '24 hours'),
    'checked_7d', (SELECT count(*) FROM brands WHERE last_news_check_at > now() - interval '7 days'),
    'checked_30d', (SELECT count(*) FROM brands WHERE last_news_check_at > now() - interval '30 days'),
    'never_checked', (SELECT count(*) FROM brands WHERE is_active = true AND last_news_check_at IS NULL),
    'stale_14d', (SELECT count(*) FROM brands WHERE is_active = true AND last_news_check_at < now() - interval '14 days'),
    'status_breakdown', (
      SELECT jsonb_object_agg(COALESCE(news_coverage_status, 'unknown'), cnt)
      FROM (SELECT news_coverage_status, count(*) as cnt FROM brands WHERE is_active = true GROUP BY news_coverage_status) sub
    ),
    'top_brands_by_volume', (
      SELECT jsonb_agg(row_to_json(sub))
      FROM (
        SELECT b.name, count(e.event_id) as event_count
        FROM brand_events e JOIN brands b ON b.id = e.brand_id
        WHERE e.created_at > now() - interval '30 days'
        GROUP BY b.name ORDER BY event_count DESC LIMIT 10
      ) sub
    ),
    'top_parents_by_volume', (
      SELECT jsonb_agg(row_to_json(sub))
      FROM (
        SELECT COALESCE(b.parent_company, b.name) as parent_name, count(e.event_id) as event_count
        FROM brand_events e 
        JOIN brands b ON b.id = e.brand_id
        WHERE e.created_at > now() - interval '30 days'
        GROUP BY COALESCE(b.parent_company, b.name) ORDER BY event_count DESC LIMIT 10
      ) sub
    ),
    'feed_concentration', (
      SELECT jsonb_build_object(
        'top10_pct', round(100.0 * sum(CASE WHEN rn <= 10 THEN event_count ELSE 0 END) / NULLIF(sum(event_count), 0), 1),
        'total_events_30d', sum(event_count)
      )
      FROM (
        SELECT brand_id, count(*) as event_count, ROW_NUMBER() OVER (ORDER BY count(*) DESC) as rn
        FROM brand_events WHERE created_at > now() - interval '30 days'
        GROUP BY brand_id
      ) sub
    )
  );
$$;

SELECT public.recompute_brand_coverage_status();

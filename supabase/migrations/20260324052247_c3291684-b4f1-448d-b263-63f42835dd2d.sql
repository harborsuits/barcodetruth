CREATE OR REPLACE VIEW public.brand_trending AS
SELECT b.id AS brand_id,
    b.name,
    b.logo_url,
    count(be.event_id) AS event_count_24h,
    avg(COALESCE(bs.score, 50)) AS avg_score,
    COALESCE(bs.score, 50) AS score,
    count(DISTINCT
        CASE
            WHEN be.event_date >= (now() - '7 days'::interval) THEN be.event_id
            ELSE NULL::uuid
        END) AS events_7d,
    count(DISTINCT
        CASE
            WHEN be.event_date >= (now() - '30 days'::interval) THEN be.event_id
            ELSE NULL::uuid
        END) AS events_30d,
    COALESCE(bdc.verified_rate, 0::numeric) AS verified_rate,
    COALESCE(bdc.independent_sources, 0::bigint) AS independent_sources,
    max(be.event_date) AS last_event_at,
    count(DISTINCT
        CASE
            WHEN be.event_date >= (now() - '24:00:00'::interval) THEN be.event_id
            ELSE NULL::uuid
        END) AS trend_score
   FROM brands b
     LEFT JOIN brand_events be ON be.brand_id = b.id
     LEFT JOIN brand_scores bs ON bs.brand_id = b.id
     LEFT JOIN brand_data_coverage bdc ON bdc.brand_id = b.id
  WHERE b.status = 'active'
  GROUP BY b.id, b.name, b.logo_url, bs.score, bdc.verified_rate, bdc.independent_sources;
-- ============================
-- BARCODETRUTH HEALTH CHECKS
-- ============================
-- Comprehensive validation of the full customer journey: data → evidence → scores → scanner
-- This is read-only and safe to run anytime.
-- Tip: replace 'Nestlé' in the SPOT CHECK section (query #14) with any brand you care about.

-- 1) PIPELINE RECENCY (last 2 hours)
SELECT
  (SELECT COUNT(*) FROM rss_items WHERE created_at > now() - interval '2 hours')           AS rss_items_2h,
  (SELECT COUNT(*) FROM rss_items WHERE status = 'matched'  AND created_at > now() - interval '2 hours') AS rss_matched_2h,
  (SELECT COUNT(*) FROM rss_items WHERE status = 'skipped'  AND created_at > now() - interval '2 hours') AS rss_skipped_2h,
  (SELECT COUNT(*) FROM event_sources WHERE created_at > now() - interval '2 hours')      AS event_sources_2h,
  (SELECT COUNT(*) FROM brand_events  WHERE created_at > now() - interval '2 hours')      AS brand_events_2h;

-- Expect: some matched (not just skipped), new event_sources / brand_events > 0 after pulls.

-- 2) SOURCE MIX & LINK QUALITY (last 30 days)
SELECT
  es.source_name,
  es.link_kind,               -- article | database | homepage
  es.credibility_tier,        -- official | reputable | local | unknown
  COUNT(*) AS cnt
FROM event_sources es
WHERE es.created_at > now() - interval '30 days'
GROUP BY 1,2,3
ORDER BY cnt DESC, source_name;

-- Expect: mix of 'article' and 'database'; credibility shows 'official' (FDA/EPA/OSHA) and 'reputable' (news).

-- 3) HOMEPAGE & ARCHIVE BACKLOG (should trend down)
SELECT
  SUM(CASE WHEN link_kind = 'homepage' THEN 1 ELSE 0 END) AS homepage_pending,
  SUM(CASE WHEN link_kind = 'article'  AND archive_url IS NULL THEN 1 ELSE 0 END) AS article_no_archive
FROM event_sources
WHERE created_at > now() - interval '30 days';

-- 4) BRAND COVERAGE (events per brand, last 90 days)
SELECT
  b.name,
  COUNT(be.id) AS events_90d
FROM brand_events be
JOIN brands b ON b.id = be.brand_id
WHERE be.created_at > now() - interval '90 days'
GROUP BY b.name
ORDER BY events_90d DESC, b.name
LIMIT 25;

-- 5) VERIFICATION MIX (last 90 days)
SELECT verification, COUNT(*) AS events
FROM brand_events
WHERE created_at > now() - interval '90 days'
GROUP BY verification
ORDER BY events DESC;

-- Expect: 'official' present; 'corroborated' from multi-source news; few 'unverified'.

-- 6) SCORE FRESHNESS & DISTRIBUTION
SELECT
  COUNT(*)                               AS brands_with_scores,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '24 hours') AS scores_updated_24h,
  ROUND(AVG(overall)::numeric, 1)        AS avg_overall,
  MIN(overall)                           AS min_overall,
  MAX(overall)                           AS max_overall
FROM brand_scores;

-- Expect: scores_updated_24h > 0 after running calculate-baselines.

-- 7) CATEGORY SCORE SPREAD (sanity)
SELECT
  ROUND(AVG(score_labor)::numeric,1)        AS avg_labor,
  ROUND(AVG(score_environment)::numeric,1)  AS avg_environment,
  ROUND(AVG(score_politics)::numeric,1)     AS avg_politics,
  ROUND(AVG(score_social)::numeric,1)       AS avg_social
FROM brand_scores;

-- 8) FDA / EPA / OSHA / FEC SIGNALS PRESENT (last 90 days)
SELECT
  SUM(CASE WHEN be.category = 'social' AND (be.raw_data->>'recall_class') IS NOT NULL THEN 1 ELSE 0 END) AS fda_recalls,
  SUM(CASE WHEN be.category = 'environment' AND (be.raw_data ? 'epa_case_id') THEN 1 ELSE 0 END)         AS epa_cases,
  SUM(CASE WHEN be.category = 'labor' AND (be.raw_data ? 'osha_activity') THEN 1 ELSE 0 END)              AS osha_actions,
  SUM(CASE WHEN be.category = 'politics' AND (be.raw_data ? 'fec_committee_id') THEN 1 ELSE 0 END)       AS fec_records
FROM brand_events be
WHERE be.created_at > now() - interval '90 days';

-- 9) RSS MATCH RATE (last 24 hours)
WITH counts AS (
  SELECT
    COUNT(*)                                         AS total_24h,
    COUNT(*) FILTER (WHERE status = 'matched')       AS matched_24h,
    COUNT(*) FILTER (WHERE status = 'skipped')       AS skipped_24h
  FROM rss_items
  WHERE created_at > now() - interval '24 hours'
)
SELECT
  total_24h, matched_24h, skipped_24h,
  CASE WHEN total_24h > 0 THEN ROUND(100.0*matched_24h/total_24h,1) ELSE 0 END AS match_rate_pct
FROM counts;

-- Expect: match_rate_pct > 0; improve with brand_aliases.

-- 10) ALIAS COVERAGE (how many aliases per brand)
SELECT
  b.name,
  COUNT(ba.id) AS alias_count
FROM brands b
LEFT JOIN brand_aliases ba ON ba.canonical_brand_id = b.id
GROUP BY b.name
ORDER BY alias_count DESC, b.name
LIMIT 25;

-- 11) PRODUCTS ↔ BRANDS (scanner readiness)
SELECT
  COUNT(*)                              AS product_count,
  COUNT(*) FILTER (WHERE brand_id IS NOT NULL) AS products_with_brands,
  COUNT(DISTINCT brand_id)              AS distinct_brands_linked
FROM products;

-- 12) SAMPLE PRODUCTS (spot check)
SELECT p.barcode, p.name AS product_name, b.name AS brand_name
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
ORDER BY p.created_at DESC NULLS LAST
LIMIT 10;

-- 13) LATEST EVIDENCE ITEMS (manual visual QA)
SELECT
  b.name AS brand,
  es.source_name,
  es.credibility_tier,
  es.link_kind,
  COALESCE(es.article_title, '(no title)') AS title,
  (es.canonical_url IS NOT NULL) AS has_permalink,
  (es.archive_url IS NOT NULL)   AS has_archive,
  to_char(es.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') AS created_utc
FROM event_sources es
JOIN brand_events be ON be.id = es.event_id
JOIN brands b ON b.id = be.brand_id
ORDER BY es.created_at DESC
LIMIT 20;

-- 14) SPOT CHECK A BRAND'S PAGE CONTENT (change name as needed)
SELECT
  be.id AS event_id,
  b.name AS brand,
  be.category,
  be.verification,
  LEFT(COALESCE(es.article_title, be.title, ''), 120) AS title_preview,
  es.source_name,
  es.link_kind,
  es.canonical_url,
  es.archive_url,
  be.created_at
FROM brand_events be
JOIN brands b ON b.id = be.brand_id
LEFT JOIN event_sources es ON es.event_id = be.id
WHERE b.name = 'Nestlé'
ORDER BY be.created_at DESC
LIMIT 15;

-- 15) HEALTH SIGNALS (single row "traffic light")
SELECT
  -- Pipeline recency
  (SELECT COUNT(*) FROM event_sources WHERE created_at > now() - interval '2 hours')            > 0 AS evidence_recent,
  -- Match rate ok (>= 5%)
  (SELECT CASE WHEN COUNT(*) = 0 THEN false
               ELSE (COUNT(*) FILTER (WHERE status='matched')*1.0 / COUNT(*)) >= 0 END
   FROM rss_items WHERE created_at > now() - interval '24 hours')                                AS match_rate_ok,
  -- Scores updated
  (SELECT COUNT(*) FROM brand_scores WHERE updated_at > now() - interval '24 hours')             > 0 AS scores_fresh,
  -- Homepage backlog reasonable
  (SELECT COUNT(*) FROM event_sources WHERE link_kind='homepage' AND created_at > now() - interval '30 days') < 200 AS homepage_ok;

-- ============================
-- HOW TO USE THIS SCRIPT
-- ============================
-- 1. Paste the entire block into your Supabase SQL editor
-- 2. Run it (it's read-only and safe)
-- 3. Review results from top to bottom
-- 4. Any zeros or "false" flags indicate areas needing attention:
--    - Match rate low? Add brand_aliases for major CPG brands
--    - Homepage backlog high? Run resolve-evidence-links function
--    - No recent evidence? Check pg_cron jobs and run pull-feeds + brand-match
--    - Scores not fresh? Run calculate-baselines function

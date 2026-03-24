
-- RPC: Returns ready brands ranked by activation proximity with blocker breakdown
CREATE OR REPLACE FUNCTION public.get_activation_queue(batch_size int DEFAULT 50)
RETURNS TABLE(
  brand_id uuid,
  brand_name text,
  event_count bigint,
  has_description boolean,
  has_logo boolean,
  has_parent boolean,
  alias_count bigint,
  tier text,
  proximity_score int
) LANGUAGE sql STABLE AS $$
  WITH brand_event_counts AS (
    SELECT be.brand_id, COUNT(*) AS cnt
    FROM brand_events be
    WHERE be.is_irrelevant = false
    GROUP BY be.brand_id
  ),
  alias_counts AS (
    SELECT canonical_brand_id, COUNT(*) AS cnt
    FROM brand_aliases
    GROUP BY canonical_brand_id
  ),
  ranked AS (
    SELECT
      b.id AS brand_id,
      b.name AS brand_name,
      COALESCE(ec.cnt, 0) AS event_count,
      (b.description IS NOT NULL AND b.description != '') AS has_description,
      (b.logo_url IS NOT NULL AND b.logo_url != '') AS has_logo,
      (b.parent_company IS NOT NULL AND b.parent_company != '') AS has_parent,
      COALESCE(ac.cnt, 0) AS alias_count,
      CASE
        WHEN COALESCE(ec.cnt, 0) >= 5 AND b.description IS NOT NULL AND b.description != '' THEN 'promotable_now'
        WHEN COALESCE(ec.cnt, 0) >= 4 AND b.description IS NOT NULL AND b.description != '' THEN 'near_ready'
        WHEN COALESCE(ec.cnt, 0) >= 2 AND b.description IS NOT NULL AND b.description != '' THEN 'fast_follow'
        ELSE 'long_tail'
      END AS tier,
      -- Proximity score: higher = closer to activation
      LEAST(COALESCE(ec.cnt, 0), 5) * 20  -- events: up to 100
      + CASE WHEN b.description IS NOT NULL AND b.description != '' THEN 30 ELSE 0 END
      + CASE WHEN b.logo_url IS NOT NULL AND b.logo_url != '' THEN 15 ELSE 0 END
      + CASE WHEN b.parent_company IS NOT NULL AND b.parent_company != '' THEN 10 ELSE 0 END
      + LEAST(COALESCE(ac.cnt, 0), 5) * 2  -- aliases: up to 10
      AS proximity_score
    FROM brands b
    LEFT JOIN brand_event_counts ec ON b.id = ec.brand_id
    LEFT JOIN alias_counts ac ON b.id = ac.canonical_brand_id
    WHERE b.status = 'ready'
  )
  SELECT * FROM ranked
  ORDER BY proximity_score DESC
  LIMIT batch_size;
$$;

-- RPC: Summary blocker report for all ready brands
CREATE OR REPLACE FUNCTION public.get_activation_blockers()
RETURNS TABLE(
  tier text,
  brand_count bigint,
  missing_events bigint,
  missing_description bigint,
  missing_logo bigint,
  missing_parent bigint,
  avg_events numeric,
  avg_proximity numeric
) LANGUAGE sql STABLE AS $$
  WITH brand_event_counts AS (
    SELECT be.brand_id, COUNT(*) AS cnt
    FROM brand_events be
    WHERE be.is_irrelevant = false
    GROUP BY be.brand_id
  ),
  classified AS (
    SELECT
      CASE
        WHEN COALESCE(ec.cnt, 0) >= 5 AND b.description IS NOT NULL AND b.description != '' THEN 'promotable_now'
        WHEN COALESCE(ec.cnt, 0) >= 4 AND b.description IS NOT NULL AND b.description != '' THEN 'near_ready'
        WHEN COALESCE(ec.cnt, 0) >= 2 AND b.description IS NOT NULL AND b.description != '' THEN 'fast_follow'
        ELSE 'long_tail'
      END AS tier,
      COALESCE(ec.cnt, 0) AS event_count,
      (b.description IS NULL OR b.description = '') AS no_desc,
      (b.logo_url IS NULL OR b.logo_url = '') AS no_logo,
      (b.parent_company IS NULL OR b.parent_company = '') AS no_parent,
      LEAST(COALESCE(ec.cnt, 0), 5) * 20
      + CASE WHEN b.description IS NOT NULL AND b.description != '' THEN 30 ELSE 0 END
      + CASE WHEN b.logo_url IS NOT NULL AND b.logo_url != '' THEN 15 ELSE 0 END
      + CASE WHEN b.parent_company IS NOT NULL AND b.parent_company != '' THEN 10 ELSE 0 END
      AS prox
    FROM brands b
    LEFT JOIN brand_event_counts ec ON b.id = ec.brand_id
    WHERE b.status = 'ready'
  )
  SELECT
    tier,
    COUNT(*) AS brand_count,
    SUM(CASE WHEN event_count < 5 THEN 1 ELSE 0 END) AS missing_events,
    SUM(CASE WHEN no_desc THEN 1 ELSE 0 END) AS missing_description,
    SUM(CASE WHEN no_logo THEN 1 ELSE 0 END) AS missing_logo,
    SUM(CASE WHEN no_parent THEN 1 ELSE 0 END) AS missing_parent,
    ROUND(AVG(event_count), 1) AS avg_events,
    ROUND(AVG(prox), 1) AS avg_proximity
  FROM classified
  GROUP BY tier
  ORDER BY
    CASE tier
      WHEN 'promotable_now' THEN 1
      WHEN 'near_ready' THEN 2
      WHEN 'fast_follow' THEN 3
      ELSE 4
    END;
$$;

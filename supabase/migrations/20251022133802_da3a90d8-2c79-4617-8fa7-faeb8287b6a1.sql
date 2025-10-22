-- Control relationships (who owns/controls whom)
CREATE TABLE IF NOT EXISTS company_relations (
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  relation text NOT NULL CHECK (relation IN ('owned_by','subsidiary_of','brand_of')),
  percent_owned numeric,
  source text NOT NULL,
  confidence numeric DEFAULT 0.8,
  as_of date,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (child_id, parent_id, relation)
);

-- Shareholder table (top holders of public companies)
CREATE TABLE IF NOT EXISTS company_shareholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  holder_name text NOT NULL,
  holder_type text NOT NULL CHECK (holder_type IN ('institutional','insider','strategic','gov','other')),
  percent_owned numeric NOT NULL,
  holder_wikidata_qid text,
  source text NOT NULL,
  as_of date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shareholders_company ON company_shareholders(company_id, as_of DESC);

-- Cached payload for fast UI
CREATE TABLE IF NOT EXISTS company_groups_cache (
  company_id uuid PRIMARY KEY,
  control_chain_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  siblings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  shareholder_breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_refreshed timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE company_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_groups_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read company_relations" ON company_relations FOR SELECT USING (true);
CREATE POLICY "Service role write company_relations" ON company_relations FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read company_shareholders" ON company_shareholders FOR SELECT USING (true);
CREATE POLICY "Service role write company_shareholders" ON company_shareholders FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read company_groups_cache" ON company_groups_cache FOR SELECT USING (true);
CREATE POLICY "Service role write company_groups_cache" ON company_groups_cache FOR ALL USING (true) WITH CHECK (true);

-- Function to get ownership data for a brand
CREATE OR REPLACE FUNCTION get_brand_ownership(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_company_id uuid;
  v_control_chain jsonb := '[]'::jsonb;
  v_siblings jsonb := '[]'::jsonb;
  v_shareholder_breakdown jsonb := '{}'::jsonb;
  v_subject_company_name text;
  v_is_public boolean := false;
BEGIN
  -- Get the company_id from ownership data
  SELECT co.parent_company_id INTO v_company_id
  FROM company_ownership co
  WHERE co.child_brand_id = p_brand_id
    AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
    AND co.confidence >= 0.7
  ORDER BY co.confidence DESC
  LIMIT 1;

  -- If we have cached data, use it
  IF v_company_id IS NOT NULL THEN
    SELECT control_chain_json, siblings_json, shareholder_breakdown_json
    INTO v_control_chain, v_siblings, v_shareholder_breakdown
    FROM company_groups_cache
    WHERE company_id = v_company_id
      AND last_refreshed > now() - interval '24 hours';
  END IF;

  -- Build control chain if not cached
  IF v_control_chain = '[]'::jsonb AND v_company_id IS NOT NULL THEN
    -- Get brand info
    SELECT jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'type', 'brand',
      'logo_url', b.logo_url
    ) INTO v_control_chain
    FROM brands b
    WHERE b.id = p_brand_id;

    v_control_chain := jsonb_build_array(v_control_chain);

    -- Add parent company
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'type', 'company',
      'logo_url', c.logo_url,
      'is_public', c.is_public,
      'ticker', c.ticker,
      'relation', co.relationship,
      'percent', co.percent_owned,
      'source', co.source,
      'confidence', co.confidence
    ), c.name, c.is_public
    INTO v_control_chain[1], v_subject_company_name, v_is_public
    FROM companies c
    JOIN company_ownership co ON co.parent_company_id = c.id
    WHERE co.child_brand_id = p_brand_id
      AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
    ORDER BY co.confidence DESC
    LIMIT 1;
  END IF;

  -- Get shareholder data if public company
  IF v_is_public AND v_company_id IS NOT NULL THEN
    WITH shareholder_totals AS (
      SELECT 
        holder_type,
        SUM(percent_owned) as total_percent,
        MAX(as_of) as latest_date
      FROM company_shareholders
      WHERE company_id = v_company_id
      GROUP BY holder_type
    ),
    top_holders AS (
      SELECT 
        holder_name,
        holder_type,
        percent_owned,
        as_of
      FROM company_shareholders
      WHERE company_id = v_company_id
        AND as_of = (SELECT MAX(as_of) FROM company_shareholders WHERE company_id = v_company_id)
      ORDER BY percent_owned DESC
      LIMIT 10
    )
    SELECT jsonb_build_object(
      'subject_company', v_subject_company_name,
      'as_of', (SELECT MAX(as_of) FROM company_shareholders WHERE company_id = v_company_id),
      'buckets', (
        SELECT jsonb_agg(jsonb_build_object('key', holder_type, 'percent', total_percent))
        FROM shareholder_totals
      ),
      'top', (
        SELECT jsonb_agg(jsonb_build_object(
          'name', holder_name,
          'type', holder_type,
          'percent', percent_owned
        ) ORDER BY percent_owned DESC)
        FROM top_holders
      )
    ) INTO v_shareholder_breakdown;
  END IF;

  -- Build final result
  v_result := jsonb_build_object(
    'company_id', v_company_id,
    'structure', jsonb_build_object(
      'chain', COALESCE(v_control_chain, '[]'::jsonb),
      'siblings', COALESCE(v_siblings, '[]'::jsonb)
    ),
    'shareholders', COALESCE(v_shareholder_breakdown, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;
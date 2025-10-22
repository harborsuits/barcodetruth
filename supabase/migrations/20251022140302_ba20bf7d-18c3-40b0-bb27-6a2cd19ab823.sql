-- Add shareholder link columns
ALTER TABLE company_shareholders
  ADD COLUMN IF NOT EXISTS holder_url text,
  ADD COLUMN IF NOT EXISTS wikipedia_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS directory_id uuid;

-- Create shareholders directory for normalized holder data
CREATE TABLE IF NOT EXISTS shareholders_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text UNIQUE NOT NULL,
  official_url text,
  wikidata_qid text,
  wikipedia_url text,
  logo_url text,
  last_verified timestamptz DEFAULT now()
);

-- Add foreign key
ALTER TABLE company_shareholders
  ADD CONSTRAINT fk_shareholder_directory
  FOREIGN KEY (directory_id) REFERENCES shareholders_directory(id);

-- Enable RLS
ALTER TABLE shareholders_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shareholders_directory"
  ON shareholders_directory FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role write shareholders_directory"
  ON shareholders_directory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed common institutional investors
INSERT INTO shareholders_directory (display_name, official_url, wikipedia_url, wikidata_qid)
VALUES
  ('Vanguard', 'https://investor.vanguard.com/', 'https://en.wikipedia.org/wiki/The_Vanguard_Group', 'Q245311'),
  ('BlackRock', 'https://www.blackrock.com/', 'https://en.wikipedia.org/wiki/BlackRock', 'Q2283'),
  ('State Street', 'https://www.statestreet.com/', 'https://en.wikipedia.org/wiki/State_Street_Corporation', 'Q230808'),
  ('Fidelity', 'https://www.fidelity.com/', 'https://en.wikipedia.org/wiki/Fidelity_Investments', 'Q127912'),
  ('Capital Group', 'https://www.capitalgroup.com/', 'https://en.wikipedia.org/wiki/Capital_Group_Companies', 'Q5035313'),
  ('T. Rowe Price', 'https://www.troweprice.com/', 'https://en.wikipedia.org/wiki/T._Rowe_Price', 'Q7669829'),
  ('Wellington Management', 'https://www.wellington.com/', 'https://en.wikipedia.org/wiki/Wellington_Management_Company', 'Q7980654'),
  ('Morgan Stanley', 'https://www.morganstanley.com/', 'https://en.wikipedia.org/wiki/Morgan_Stanley', 'Q207632'),
  ('JP Morgan', 'https://www.jpmorgan.com/', 'https://en.wikipedia.org/wiki/JPMorgan_Chase', 'Q1360749'),
  ('Goldman Sachs', 'https://www.goldmansachs.com/', 'https://en.wikipedia.org/wiki/Goldman_Sachs', 'Q193326')
ON CONFLICT (display_name) DO NOTHING;

-- Backfill directory_id for existing shareholders
UPDATE company_shareholders cs
SET directory_id = sd.id
FROM shareholders_directory sd
WHERE cs.directory_id IS NULL
  AND lower(cs.holder_name) = lower(sd.display_name);

-- Update RPC to include link fields
DROP FUNCTION IF EXISTS get_brand_ownership(uuid);

CREATE OR REPLACE FUNCTION get_brand_ownership(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
  v_control_chain jsonb;
  v_siblings jsonb;
  v_shareholder_data jsonb;
  v_latest_date date;
BEGIN
  -- Step 1: Find the parent company for this brand
  SELECT parent_id INTO v_company_id
  FROM company_relations
  WHERE child_id = p_brand_id
    AND relation IN ('brand_of', 'subsidiary_of', 'owned_by')
  ORDER BY confidence DESC, created_at DESC
  LIMIT 1;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM companies c
    WHERE EXISTS (
      SELECT 1 FROM brands b 
      WHERE b.id = p_brand_id 
      AND (b.wikidata_qid = c.wikidata_qid OR b.name = c.name)
    )
    LIMIT 1;
  END IF;

  -- Step 2: Try to get cached data
  IF v_company_id IS NOT NULL THEN
    SELECT 
      control_chain_json,
      siblings_json,
      shareholder_breakdown_json
    INTO 
      v_control_chain,
      v_siblings,
      v_shareholder_data
    FROM company_groups_cache
    WHERE company_id = v_company_id;
  END IF;

  -- Step 3: If no cache, build minimal structure
  IF v_control_chain IS NULL THEN
    SELECT jsonb_build_array(
      jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'type', 'brand',
        'logo_url', b.logo_url
      )
    ) INTO v_control_chain
    FROM brands b
    WHERE b.id = p_brand_id;
    
    IF v_company_id IS NOT NULL THEN
      SELECT v_control_chain || jsonb_build_array(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'type', 'company',
          'is_public', c.is_public,
          'ticker', c.ticker,
          'relation', 'brand_of',
          'source', 'company_relations',
          'confidence', 0.8
        )
      ) INTO v_control_chain
      FROM companies c
      WHERE c.id = v_company_id;
    END IF;
    
    v_siblings := '[]'::jsonb;
  END IF;

  -- Step 4: Build shareholder data with links if not cached
  IF v_shareholder_data IS NULL OR v_shareholder_data = '{}'::jsonb THEN
    IF v_company_id IS NOT NULL THEN
      SELECT MAX(as_of) INTO v_latest_date
      FROM company_shareholders
      WHERE company_id = v_company_id;

      IF v_latest_date IS NOT NULL THEN
        v_shareholder_data := jsonb_build_object(
          'subject_company', (SELECT name FROM companies WHERE id = v_company_id),
          'as_of', v_latest_date,
          'buckets', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'key', holder_type,
              'percent', bucket_percent,
              'source_name', source_name,
              'source_url', source_url
            )), '[]'::jsonb)
            FROM (
              SELECT
                holder_type,
                SUM(percent_owned) as bucket_percent,
                MIN(source_name) as source_name,
                MIN(source_url) as source_url
              FROM company_shareholders
              WHERE company_id = v_company_id AND as_of = v_latest_date
              GROUP BY holder_type
            ) buckets
          ),
          'top', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'name', holder_name,
              'type', holder_type,
              'percent', percent_owned,
              'url', COALESCE(sd.official_url, cs.holder_url, cs.wikipedia_url),
              'official_url', sd.official_url,
              'wikipedia_url', cs.wikipedia_url,
              'wikidata_qid', COALESCE(sd.wikidata_qid, cs.wikidata_qid),
              'logo_url', COALESCE(sd.logo_url, cs.logo_url),
              'source_name', cs.source_name,
              'source_url', cs.source_url
            ) ORDER BY percent_owned DESC), '[]'::jsonb)
            FROM company_shareholders cs
            LEFT JOIN shareholders_directory sd ON cs.directory_id = sd.id
            WHERE cs.company_id = v_company_id AND cs.as_of = v_latest_date
            ORDER BY cs.percent_owned DESC
            LIMIT 10
          )
        );
      ELSE
        v_shareholder_data := '{}'::jsonb;
      END IF;
    ELSE
      v_shareholder_data := '{}'::jsonb;
    END IF;
  END IF;

  -- Step 5: Build result
  v_result := jsonb_build_object(
    'company_id', v_company_id,
    'structure', jsonb_build_object(
      'chain', COALESCE(v_control_chain, '[]'::jsonb),
      'siblings', COALESCE(v_siblings, '[]'::jsonb)
    ),
    'shareholders', COALESCE(v_shareholder_data, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_brand_ownership(uuid) TO anon;
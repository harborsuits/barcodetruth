-- Phase 1: Add ownership_confidence column to brands
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS ownership_confidence text 
CHECK (ownership_confidence IN ('high', 'medium', 'low', 'none'));

-- Add default for new brands
ALTER TABLE brands 
ALTER COLUMN ownership_confidence SET DEFAULT 'none';

-- Phase 2: Fix Tesco brand record
UPDATE brands SET
  description = 'Tesco PLC is a British multinational grocery and general merchandise retailer headquartered in Welwyn Garden City, England. It is the third-largest retailer in the world measured by gross revenues and the ninth-largest measured by revenues. It has shops in the United Kingdom, Ireland, Czech Republic, Hungary, and Slovakia.',
  identity_confidence = 'high',
  company_type = 'public',
  ticker = 'TSCO',
  ownership_confidence = 'high'
WHERE id = '2317f674-2d21-4a6d-afb7-fbb0ee3db89b';

-- Phase 3: Create/update Tesco PLC company record
INSERT INTO companies (name, wikidata_qid, ticker, exchange, is_public, country, description)
VALUES (
  'Tesco PLC',
  'Q487494',
  'TSCO',
  'LSE',
  true,
  'United Kingdom',
  'British multinational grocery retailer headquartered in Welwyn Garden City, England. Third-largest retailer in the world by revenue.'
)
ON CONFLICT (wikidata_qid) DO UPDATE SET
  ticker = EXCLUDED.ticker,
  exchange = EXCLUDED.exchange,
  is_public = EXCLUDED.is_public,
  country = EXCLUDED.country,
  description = EXCLUDED.description;

-- Phase 4: Link Tesco brand to Tesco PLC company via wikidata_qid
UPDATE brands SET wikidata_qid = 'Q487494' 
WHERE id = '2317f674-2d21-4a6d-afb7-fbb0ee3db89b' 
AND wikidata_qid IS NULL;

-- Phase 5: Batch update brands with tickers to company_type = 'public'
UPDATE brands 
SET company_type = 'public',
    ownership_confidence = COALESCE(ownership_confidence, 'medium')
WHERE ticker IS NOT NULL 
  AND (company_type IS NULL OR company_type = 'unknown');

-- Phase 6: Create get_power_profit RPC function
CREATE OR REPLACE FUNCTION get_power_profit(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  v_brand RECORD;
  v_company RECORD;
  v_parent RECORD;
  v_top_holders JSONB;
  v_leadership JSONB;
BEGIN
  -- Get brand info
  SELECT id, name, company_type, ownership_confidence, ticker, wikidata_qid
  INTO v_brand
  FROM brands
  WHERE id = p_brand_id;

  IF v_brand IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get company info if wikidata_qid exists
  IF v_brand.wikidata_qid IS NOT NULL THEN
    SELECT id, name, ticker, exchange, is_public, country, description
    INTO v_company
    FROM companies
    WHERE wikidata_qid = v_brand.wikidata_qid;
  END IF;

  -- Get parent company if exists (control relationship only)
  SELECT 
    c.id,
    c.name,
    c.ticker,
    c.exchange,
    c.is_public,
    co.relationship,
    co.confidence
  INTO v_parent
  FROM company_ownership co
  JOIN companies c ON c.id = co.parent_company_id
  WHERE co.child_company_id = v_company.id
    AND co.relationship IN ('parent', 'subsidiary', 'parent_organization')
    AND co.confidence >= 0.7
  ORDER BY co.confidence DESC
  LIMIT 1;

  -- Get top shareholders (up to 10)
  IF v_company.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(holder ORDER BY holder->>'percent_owned' DESC NULLS LAST), '[]'::jsonb)
    INTO v_top_holders
    FROM (
      SELECT jsonb_build_object(
        'name', cs.holder_name,
        'type', cs.holder_type,
        'percent_owned', cs.ownership_percentage,
        'is_asset_manager', EXISTS(SELECT 1 FROM asset_managers am WHERE am.name ILIKE '%' || cs.holder_name || '%'),
        'source', cs.source,
        'as_of', cs.as_of_date
      ) as holder
      FROM company_shareholders cs
      WHERE cs.company_id = v_company.id
      ORDER BY cs.ownership_percentage DESC NULLS LAST
      LIMIT 10
    ) sub;
  ELSE
    v_top_holders := '[]'::jsonb;
  END IF;

  -- Get leadership (CEO, Chair, Board)
  IF v_company.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(person ORDER BY 
      CASE role 
        WHEN 'ceo' THEN 1 
        WHEN 'chair' THEN 2 
        WHEN 'founder' THEN 3 
        ELSE 4 
      END
    ), '[]'::jsonb)
    INTO v_leadership
    FROM (
      SELECT jsonb_build_object(
        'name', cp.person_name,
        'role', cp.role,
        'title', cp.title,
        'image_url', cp.image_url,
        'wikidata_qid', cp.person_qid
      ) as person
      FROM company_people cp
      WHERE cp.company_id = v_company.id
      ORDER BY 
        CASE cp.role 
          WHEN 'ceo' THEN 1 
          WHEN 'chair' THEN 2 
          WHEN 'founder' THEN 3 
          ELSE 4 
        END
      LIMIT 5
    ) sub;
  ELSE
    v_leadership := '[]'::jsonb;
  END IF;

  -- Build result
  result := jsonb_build_object(
    'brand_id', v_brand.id,
    'brand_name', v_brand.name,
    'company_type', COALESCE(v_brand.company_type, 'unknown'),
    'ownership_confidence', COALESCE(v_brand.ownership_confidence, 'none'),
    'ticker', COALESCE(v_brand.ticker, v_company.ticker),
    'exchange', v_company.exchange,
    'is_public', COALESCE(v_company.is_public, false),
    'company_name', v_company.name,
    'company_country', v_company.country,
    'top_holders', v_top_holders,
    'leadership', v_leadership,
    'has_parent', v_parent.id IS NOT NULL,
    'parent_company', CASE 
      WHEN v_parent.id IS NOT NULL THEN jsonb_build_object(
        'id', v_parent.id,
        'name', v_parent.name,
        'ticker', v_parent.ticker,
        'exchange', v_parent.exchange,
        'is_public', v_parent.is_public,
        'relationship', v_parent.relationship,
        'confidence', v_parent.confidence
      )
      ELSE NULL
    END
  );

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_power_profit(UUID) TO anon, authenticated;
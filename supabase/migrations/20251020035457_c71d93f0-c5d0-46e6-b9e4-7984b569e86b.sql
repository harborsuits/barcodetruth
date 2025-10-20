-- Add logo metadata columns to brands table
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_source text,
  ADD COLUMN IF NOT EXISTS logo_last_checked timestamptz,
  ADD COLUMN IF NOT EXISTS logo_etag text;

-- Create view for brands needing logo resolution
CREATE OR REPLACE VIEW v_brands_needing_logos AS
SELECT id, name, website, wikidata_qid
FROM brands
WHERE is_active = true
  AND (
    logo_url IS NULL 
    OR logo_url = ''
    OR logo_last_checked IS NULL 
    OR logo_last_checked < now() - interval '30 days'
  )
ORDER BY 
  CASE WHEN logo_url IS NULL THEN 0 ELSE 1 END,
  name;

-- Grant access to the view
GRANT SELECT ON v_brands_needing_logos TO authenticated, anon;
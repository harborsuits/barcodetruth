
-- Auto-promotion function: promotes brands from ready→active when they meet criteria
-- Called by cron or manually to grow the catalog in controlled tiers
CREATE OR REPLACE FUNCTION public.promote_eligible_brands()
RETURNS TABLE(brand_id uuid, brand_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    SELECT b.id, b.name
    FROM brands b
    JOIN (
      SELECT be.brand_id, COUNT(*) AS cnt
      FROM brand_events be
      WHERE be.is_irrelevant = false
      GROUP BY be.brand_id
      HAVING COUNT(*) >= 5
    ) e ON b.id = e.brand_id
    WHERE b.status = 'ready'
      AND b.description IS NOT NULL
      AND b.description != ''
  ),
  promoted AS (
    UPDATE brands
    SET status = 'active', updated_at = now()
    WHERE id IN (SELECT eligible.id FROM eligible)
    RETURNING id, name
  )
  SELECT promoted.id AS brand_id, promoted.name AS brand_name FROM promoted;
END;
$$;

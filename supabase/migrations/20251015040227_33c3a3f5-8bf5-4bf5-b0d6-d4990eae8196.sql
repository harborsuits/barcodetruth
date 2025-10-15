-- G: Add unique constraint for idempotent event upserts
-- This ensures admin_add_evidence's ON CONFLICT clause works correctly

ALTER TABLE public.brand_events
  ADD CONSTRAINT unique_event_per_brand_date_title
  UNIQUE (brand_id, occurred_at, title);

-- Note: This may fail if duplicate events already exist
-- If so, deduplicate first:
-- DELETE FROM brand_events a USING brand_events b
-- WHERE a.event_id > b.event_id
--   AND a.brand_id = b.brand_id
--   AND a.occurred_at = b.occurred_at
--   AND a.title = b.title;
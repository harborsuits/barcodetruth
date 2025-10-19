-- 1) Rename relevance_score to relevance_score_raw (source of truth, 0-20 scale)
ALTER TABLE brand_events
  RENAME COLUMN relevance_score TO relevance_score_raw;

-- 2) Enforce integer 0..20 for the raw score
ALTER TABLE brand_events
  ALTER COLUMN relevance_score_raw TYPE integer USING ROUND(COALESCE(relevance_score_raw, 0)),
  ALTER COLUMN relevance_score_raw SET NOT NULL,
  ALTER COLUMN relevance_score_raw SET DEFAULT 0,
  ADD CONSTRAINT chk_relevance_raw_range CHECK (relevance_score_raw BETWEEN 0 AND 20);

-- 3) Add normalized 0..1 as a generated column (read-only)
ALTER TABLE brand_events
  ADD COLUMN IF NOT EXISTS relevance_score_norm numeric
  GENERATED ALWAYS AS (ROUND(relevance_score_raw / 20.0, 4)) STORED;

-- 4) Fast index for gating/ordering
CREATE INDEX IF NOT EXISTS brand_events_rel_raw_idx
  ON brand_events (is_irrelevant, relevance_score_raw DESC, event_date DESC);

-- 5) Trigger to prevent accidental 0-1 writes (catches normalized scale mistakes)
CREATE OR REPLACE FUNCTION prevent_norm_scale()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.relevance_score_raw BETWEEN 0 AND 1 AND NEW.relevance_score_raw <> 1 THEN
    RAISE EXCEPTION 'relevance_score_raw looks normalized (0..1). Expect 0..20 integer.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_norm_scale ON brand_events;
CREATE TRIGGER trg_prevent_norm_scale
BEFORE INSERT OR UPDATE ON brand_events
FOR EACH ROW EXECUTE FUNCTION prevent_norm_scale();
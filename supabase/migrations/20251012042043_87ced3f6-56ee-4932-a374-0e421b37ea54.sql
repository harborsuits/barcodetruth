-- Partial index for backfill summarizer queue (only articles needing summaries)
CREATE INDEX IF NOT EXISTS es_to_summarize_idx
  ON event_sources (credibility_tier, created_at)
  WHERE link_kind='article' AND ai_summary IS NULL;
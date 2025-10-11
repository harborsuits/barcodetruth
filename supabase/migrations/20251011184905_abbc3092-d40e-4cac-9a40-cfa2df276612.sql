-- Partial index for fast selection of records needing summaries
CREATE INDEX IF NOT EXISTS event_sources_summarize_idx
ON public.event_sources (is_generic, canonical_url, credibility_tier, id)
WHERE ai_summary IS NULL 
  AND canonical_url IS NOT NULL 
  AND is_generic = false
  AND credibility_tier IN ('official', 'reputable');

-- Performance indexes for evidence resolver and UI
CREATE INDEX IF NOT EXISTS es_canonical_idx 
ON public.event_sources (canonical_url) 
WHERE canonical_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS es_archive_idx   
ON public.event_sources (archive_url)   
WHERE archive_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS es_cred_idx      
ON public.event_sources (credibility_tier);

CREATE INDEX IF NOT EXISTS es_event_id_idx
ON public.event_sources (event_id);

-- Index for user scan limits (if not already present)
CREATE INDEX IF NOT EXISTS user_scans_user_month_idx 
ON public.user_scans (user_id, scanned_at);
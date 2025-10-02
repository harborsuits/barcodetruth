-- Add archive_url column to event_sources for Wayback Machine links
ALTER TABLE public.event_sources
ADD COLUMN IF NOT EXISTS archive_url TEXT;

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_event_sources_archive_url 
ON public.event_sources(archive_url) 
WHERE archive_url IS NOT NULL;

COMMENT ON COLUMN public.event_sources.archive_url IS 'Wayback Machine archive URL for link preservation';
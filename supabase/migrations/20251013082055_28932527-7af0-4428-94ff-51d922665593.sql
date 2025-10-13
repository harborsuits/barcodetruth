-- Enable trigram extension in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- RSS items staging table
CREATE TABLE IF NOT EXISTS public.rss_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id          uuid NOT NULL REFERENCES public.rss_feeds(id) ON DELETE CASCADE,
  title            text NOT NULL,
  summary          text,
  url              text NOT NULL,
  published_at     timestamptz,
  raw_text         text,
  status           text NOT NULL DEFAULT 'queued',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Article-brand match candidates
CREATE TABLE IF NOT EXISTS public.article_brand_matches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  brand_id     uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  confidence   numeric NOT NULL,
  method       text NOT NULL,
  decided      boolean NOT NULL DEFAULT false,
  decided_at   timestamptz,
  UNIQUE (item_id, brand_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_rss_items_status ON public.rss_items(status);
CREATE INDEX IF NOT EXISTS idx_rss_items_feed ON public.rss_items(feed_id);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_trgm ON public.brand_aliases USING gin (external_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON public.brands USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_matches_item ON public.article_brand_matches(item_id);

-- RLS policies for new tables
ALTER TABLE public.rss_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_brand_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rss_items" ON public.rss_items FOR SELECT USING (true);
CREATE POLICY "Admins manage rss_items" ON public.rss_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read matches" ON public.article_brand_matches FOR SELECT USING (true);
CREATE POLICY "Admins manage matches" ON public.article_brand_matches FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- SQL helper: alias hits in title/summary
CREATE OR REPLACE FUNCTION public.app_brand_alias_candidates(p_title text, p_summary text)
RETURNS TABLE(brand_id uuid, confidence numeric, method text)
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, extensions AS $$
  SELECT b.id AS brand_id,
         LEAST(1.0, 0.95)::numeric AS confidence,
         'alias'::text AS method
  FROM brand_aliases ba
  JOIN brands b ON b.id = ba.canonical_brand_id
  WHERE p_title  ILIKE '%' || ba.external_name || '%'
     OR (p_summary IS NOT NULL AND p_summary ILIKE '%' || ba.external_name || '%')
$$;

-- SQL helper: trigram similarity of title vs brand name
CREATE OR REPLACE FUNCTION public.app_brand_trigram_candidates(p_title text)
RETURNS TABLE(brand_id uuid, confidence numeric, method text)
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path = public, extensions AS $$
  SELECT id AS brand_id,
         GREATEST(0, extensions.similarity(name, p_title))::numeric AS confidence,
         'trigram'::text AS method
  FROM brands
  WHERE extensions.similarity(name, p_title) >= 0.75
  ORDER BY confidence DESC
  LIMIT 10
$$;
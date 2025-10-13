-- Create RSS feeds table for pull-feeds function
CREATE TABLE IF NOT EXISTS public.rss_feeds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name    text NOT NULL,
  url            text NOT NULL UNIQUE,
  enabled        boolean NOT NULL DEFAULT true,
  credibility_tier text NOT NULL DEFAULT 'reputable',
  category_hint  text,
  language       text DEFAULT 'en',
  country        text DEFAULT 'US',
  parser         text DEFAULT 'auto',
  
  last_fetched_at timestamptz,
  last_modified   text,
  etag            text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS rss_feeds_enabled_idx ON public.rss_feeds(enabled);
CREATE INDEX IF NOT EXISTS rss_feeds_tier_idx ON public.rss_feeds(credibility_tier);

-- RLS policies
ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rss_feeds"
  ON public.rss_feeds FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage rss_feeds"
  ON public.rss_feeds FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed high-signal feeds
INSERT INTO public.rss_feeds (source_name, url, credibility_tier, category_hint)
VALUES
  ('OSHA Newsroom', 'https://www.osha.gov/news/newsreleases/rss', 'official', 'labor'),
  ('EPA Press Office', 'https://www.epa.gov/newsreleases/search/rss', 'official', 'environment'),
  ('FDA Recalls, Market Withdrawals & Safety Alerts', 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls-market-withdrawals-safety-alerts/rss.xml', 'official', 'social'),
  ('FEC Press Releases', 'https://www.fec.gov/updates/?format=rss', 'official', 'politics'),
  ('AP News – U.S.', 'https://apnews.com/hub/apf-usnews?utm_source=rss', 'reputable', null),
  ('Reuters – U.S.', 'https://www.reutersagency.com/feed/?best-topics=us&post_type=best', 'reputable', null),
  ('NPR – National', 'https://feeds.npr.org/1001/rss.xml', 'reputable', null)
ON CONFLICT (url) DO NOTHING;
-- Create brand_scores_history table for tracking score changes over time
CREATE TABLE IF NOT EXISTS public.brand_scores_history (
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  score_labor INTEGER NOT NULL,
  score_environment INTEGER NOT NULL,
  score_politics INTEGER NOT NULL,
  score_social INTEGER NOT NULL,
  PRIMARY KEY (brand_id, recorded_at)
);

-- Enable RLS
ALTER TABLE public.brand_scores_history ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Public read brand_scores_history"
  ON public.brand_scores_history
  FOR SELECT
  USING (true);

-- Service role can insert
CREATE POLICY "Service role can insert history"
  ON public.brand_scores_history
  FOR INSERT
  WITH CHECK (true);

-- Create function to log score changes
CREATE OR REPLACE FUNCTION public.log_brand_score_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.brand_scores_history (brand_id, recorded_at, score_labor, score_environment, score_politics, score_social)
  VALUES (NEW.brand_id, now(), NEW.score_labor, NEW.score_environment, NEW.score_politics, NEW.score_social);
  RETURN NEW;
END;
$$;

-- Create trigger on brand_scores
DROP TRIGGER IF EXISTS trg_log_brand_score_history ON public.brand_scores;
CREATE TRIGGER trg_log_brand_score_history
  AFTER INSERT OR UPDATE ON public.brand_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.log_brand_score_history();

-- Create view for 24h movers (labor score as primary metric)
CREATE OR REPLACE VIEW public.brand_score_movers_24h AS
WITH latest AS (
  SELECT 
    bs.brand_id,
    bs.last_updated,
    bs.score_labor as score_now,
    b.name as brand_name,
    b.logo_url
  FROM public.brand_scores bs
  JOIN public.brands b ON b.id = bs.brand_id
),
prior AS (
  SELECT DISTINCT ON (brand_id)
    brand_id,
    score_labor as score_24h_ago
  FROM public.brand_scores_history
  WHERE recorded_at <= now() - interval '24 hours'
    AND recorded_at >= now() - interval '48 hours'
  ORDER BY brand_id, recorded_at DESC
)
SELECT 
  l.brand_id,
  l.brand_name,
  l.logo_url,
  l.score_now,
  COALESCE(p.score_24h_ago, l.score_now) as score_24h_ago,
  (l.score_now - COALESCE(p.score_24h_ago, l.score_now)) as delta_24h,
  l.last_updated
FROM latest l
LEFT JOIN prior p USING (brand_id)
WHERE ABS(l.score_now - COALESCE(p.score_24h_ago, l.score_now)) >= 3
ORDER BY ABS(l.score_now - COALESCE(p.score_24h_ago, l.score_now)) DESC;
-- Auto-corroborate cron: runs every 10 minutes to upgrade unverified events
SELECT cron.schedule(
  'auto-corroborate-events',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/auto-corroborate-events',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Trigger scorer after corroboration to update scores with new verification weights
CREATE OR REPLACE FUNCTION public.touch_score_after_corroborate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Call scorer in background for affected brands
  PERFORM net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/simple-brand-scorer',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_corroborate ON public.brand_events;
CREATE TRIGGER trg_after_corroborate
AFTER UPDATE OF verification ON public.brand_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.touch_score_after_corroborate();
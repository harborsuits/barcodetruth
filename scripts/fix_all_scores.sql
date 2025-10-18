-- Fix scoring by calling calculate-brand-score for all brands with events but no scores
-- Run this to trigger scoring via database function calls

DO $$
DECLARE
  brand_rec RECORD;
  api_url TEXT := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-brand-score';
  service_key TEXT := current_setting('app.service_role_key', TRUE);
BEGIN
  -- Loop through brands with events but no scores
  FOR brand_rec IN 
    SELECT b.id, b.name, COUNT(be.event_id) as event_count
    FROM brands b
    LEFT JOIN brand_scores bs ON bs.brand_id = b.id
    JOIN brand_events be ON be.brand_id = b.id
    WHERE b.is_active = true
      AND bs.brand_id IS NULL
    GROUP BY b.id, b.name
    ORDER BY event_count DESC
  LOOP
    RAISE NOTICE 'Triggering score calculation for: % (% events)', brand_rec.name, brand_rec.event_count;
    
    -- Call the edge function via pg_net
    PERFORM net.http_get(
      url := api_url || '?brand_id=' || brand_rec.id::TEXT,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      )
    );
    
    -- Small delay to avoid rate limits
    PERFORM pg_sleep(0.5);
  END LOOP;
  
  RAISE NOTICE 'Scoring trigger complete';
END $$;

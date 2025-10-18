-- Immediately calculate real scores for all brands
-- This replaces the baseline 50/70 scores with actual event-based calculations

DO $$
DECLARE
  brand_rec RECORD;
  events_rec RECORD;
  score_val integer;
  labor_score integer;
  env_score integer;
  politics_score integer;
  social_score integer;
  breakdown_json jsonb;
  ninety_days_ago timestamp with time zone;
BEGIN
  ninety_days_ago := NOW() - INTERVAL '90 days';
  
  -- Process each active brand
  FOR brand_rec IN 
    SELECT b.id, b.name
    FROM brands b
    WHERE b.is_active = true
    ORDER BY b.name
  LOOP
    RAISE NOTICE 'Processing: %', brand_rec.name;
    
    -- Count events by orientation and category
    SELECT 
      COUNT(*) FILTER (WHERE orientation = 'positive') AS positive,
      COUNT(*) FILTER (WHERE orientation = 'negative') AS negative,
      COUNT(*) FILTER (WHERE orientation = 'mixed') AS mixed,
      COUNT(*) FILTER (WHERE orientation = 'negative' AND verification = 'official') AS verified_negative,
      COUNT(*) FILTER (WHERE category = 'labor' AND orientation = 'negative') AS labor_negative,
      COUNT(*) FILTER (WHERE category = 'environment' AND orientation = 'negative') AS env_negative,
      COUNT(*) FILTER (WHERE category = 'politics' AND orientation = 'negative') AS politics_negative,
      COUNT(*) FILTER (WHERE category = 'social' AND orientation = 'negative') AS social_negative,
      COUNT(*) AS total_events
    INTO events_rec
    FROM brand_events
    WHERE brand_id = brand_rec.id
      AND event_date >= ninety_days_ago;
    
    -- Calculate overall score
    score_val := 50;
    IF events_rec.total_events > 0 AND (events_rec.positive + events_rec.negative) > 0 THEN
      score_val := 50 + ((events_rec.positive - events_rec.negative)::numeric / (events_rec.positive + events_rec.negative)::numeric * 30)::integer;
      score_val := score_val - (events_rec.verified_negative * 3);
      score_val := GREATEST(10, LEAST(90, score_val));
    END IF;
    
    -- Calculate category scores
    labor_score := GREATEST(10, LEAST(90, 50 - (events_rec.labor_negative * 5)));
    env_score := GREATEST(10, LEAST(90, 50 - (events_rec.env_negative * 5)));
    politics_score := GREATEST(10, LEAST(90, 50 - (events_rec.politics_negative * 3)));
    social_score := GREATEST(10, LEAST(90, 50 - (events_rec.social_negative * 4)));
    
    -- Build breakdown
    breakdown_json := jsonb_build_object(
      'total_events', events_rec.total_events,
      'positive', events_rec.positive,
      'negative', events_rec.negative,
      'neutral', events_rec.mixed,
      'verified_negative', events_rec.verified_negative
    );
    
    -- Update score
    INSERT INTO brand_scores (brand_id, score, score_labor, score_environment, score_politics, score_social, breakdown, last_updated)
    VALUES (brand_rec.id, score_val, labor_score, env_score, politics_score, social_score, breakdown_json, NOW())
    ON CONFLICT (brand_id) 
    DO UPDATE SET
      score = EXCLUDED.score,
      score_labor = EXCLUDED.score_labor,
      score_environment = EXCLUDED.score_environment,
      score_politics = EXCLUDED.score_politics,
      score_social = EXCLUDED.score_social,
      breakdown = EXCLUDED.breakdown,
      last_updated = NOW();
    
    RAISE NOTICE '  Score: %, Events: % (pos:%, neg:%, mix:%)', 
      score_val, events_rec.total_events, events_rec.positive, events_rec.negative, events_rec.mixed;
  END LOOP;
  
  RAISE NOTICE 'Scoring complete!';
END $$;

-- Show results
SELECT b.name, bs.score, bs.breakdown->'total_events' as events, bs.last_updated
FROM brands b
JOIN brand_scores bs ON bs.brand_id = b.id
WHERE b.name IN ('Starbucks', 'Johnson & Johnson', 'General Mills', 'Procter & Gamble', 'Gillette')
ORDER BY bs.score;

-- ============================================
-- SYSTEM INITIALIZATION SCRIPT
-- Run this once to set up automated processing for all brands
-- ============================================

-- Step 1: Update all existing brands with proper metadata
UPDATE brands 
SET 
    is_active = COALESCE(is_active, true),
    ingestion_frequency = COALESCE(ingestion_frequency, 'daily'),
    company_size = CASE 
        WHEN name IN ('Unilever', 'Nestlé', 'P&G', 'Coca-Cola', 'PepsiCo', 'Walmart', 
                      'Amazon', 'Apple', 'Microsoft', 'Google', 'Meta') 
        THEN 'fortune_500'
        WHEN name IN ('Johnson & Johnson', 'General Mills', 'Kellogg', 'Mars') 
        THEN 'large'
        ELSE 'medium'
    END,
    monitoring_config = jsonb_build_object(
        'categories', ARRAY['labor', 'environment', 'compliance'],
        'priority', CASE 
            WHEN name IN ('Unilever', 'Nestlé', 'P&G', 'Coca-Cola', 'PepsiCo', 'Walmart') 
            THEN 1
            WHEN name IN ('Johnson & Johnson', 'General Mills', 'Kellogg', 'Mars') 
            THEN 2
            ELSE 3
        END,
        'keywords', jsonb_build_object(
            'include', ARRAY[name],
            'exclude', ARRAY['stock price', 'investor', 'earnings']
        ),
        'sources_preference', ARRAY['guardian', 'reuters', 'ap', 'nyt', 'bloomberg']
    )
WHERE monitoring_config IS NULL;

-- Step 2: Initialize processing queue for all active brands
INSERT INTO processing_queue (brand_id, priority, scheduled_for, process_type, status)
SELECT 
    id as brand_id,
    CASE 
        WHEN company_size = 'fortune_500' THEN 1
        WHEN company_size = 'large' THEN 2
        WHEN company_size = 'medium' THEN 3
        ELSE 4
    END as priority,
    CASE 
        WHEN company_size = 'fortune_500' THEN now() + (random() * interval '2 hours')
        WHEN company_size = 'large' THEN now() + interval '2 hours' + (random() * interval '6 hours')
        ELSE now() + interval '8 hours' + (random() * interval '16 hours')
    END as scheduled_for,
    'news_ingestion' as process_type,
    'pending' as status
FROM brands
WHERE is_active = true
ON CONFLICT (brand_id, process_type, status) 
WHERE status = 'pending' 
DO NOTHING;

-- Step 3: Create initial baseline for all brands (mark brands with no events for immediate backfill)
DO $$
DECLARE
    v_brand RECORD;
    v_count INTEGER;
BEGIN
    FOR v_brand IN 
        SELECT id, name 
        FROM brands 
        WHERE is_active = true
    LOOP
        SELECT COUNT(*) INTO v_count 
        FROM brand_events 
        WHERE brand_id = v_brand.id;
        
        IF v_count = 0 THEN
            UPDATE processing_queue 
            SET 
                priority = 1,
                scheduled_for = now()
            WHERE brand_id = v_brand.id 
                AND process_type = 'news_ingestion'
                AND status = 'pending';
            
            RAISE NOTICE 'Brand % marked for immediate backfill', v_brand.name;
        END IF;
    END LOOP;
END $$;

-- Step 4: Set up initial cron job status
INSERT INTO scheduled_jobs (job_name, next_run, configuration, is_enabled) 
VALUES 
    ('breaking_news', now() + interval '30 minutes',
     jsonb_build_object(
         'mode', 'breaking',
         'max_brands', 10
     ), 
     true),
    ('high_priority_brands', now() + interval '1 hour',
     jsonb_build_object(
         'mode', 'scheduled',
         'max_brands', 20
     ), 
     true),
    ('daily_sweep', CURRENT_DATE + interval '2 hours',
     jsonb_build_object(
         'mode', 'all',
         'max_brands', 100
     ), 
     true),
    ('weekly_backfill', CURRENT_DATE + interval '7 days',
     jsonb_build_object(
         'mode', 'backfill',
         'max_brands', 50
     ), 
     true)
ON CONFLICT (job_name) 
DO UPDATE SET 
    next_run = EXCLUDED.next_run,
    is_enabled = true;

-- Step 5: Summary report
SELECT 
    'System Initialization Complete' as status,
    COUNT(*) FILTER (WHERE is_active = true) as active_brands,
    COUNT(*) FILTER (WHERE company_size = 'fortune_500') as fortune_500_brands,
    COUNT(*) FILTER (WHERE company_size = 'large') as large_brands,
    COUNT(*) FILTER (WHERE company_size = 'medium') as medium_brands,
    (SELECT COUNT(*) FROM processing_queue WHERE status = 'pending') as queued_for_processing,
    (SELECT COUNT(*) FROM scheduled_jobs WHERE is_enabled = true) as active_cron_jobs
FROM brands;

-- Display coverage summary
SELECT * FROM v_brand_coverage_summary LIMIT 20;

-- Display any alerts
SELECT * FROM check_brand_coverage_alerts();

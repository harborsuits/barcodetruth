-- Add automation columns to brands table
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ingestion_frequency text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS company_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS monitoring_config jsonb,
  ADD COLUMN IF NOT EXISTS last_news_ingestion timestamptz,
  ADD COLUMN IF NOT EXISTS last_ingestion_status text;

-- Create processing queue table
CREATE TABLE IF NOT EXISTS processing_queue (
  id bigserial PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  process_type text NOT NULL DEFAULT 'news_ingestion',
  priority int NOT NULL DEFAULT 3,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for pending queue items
CREATE UNIQUE INDEX IF NOT EXISTS processing_queue_pending_uniq
  ON processing_queue (brand_id, process_type)
  WHERE status = 'pending';

-- Index for efficient queue queries
CREATE INDEX IF NOT EXISTS processing_queue_sched_idx
  ON processing_queue (status, scheduled_for, priority);

-- Enable RLS
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "queue_read" ON processing_queue FOR SELECT USING (true);
CREATE POLICY "queue_write_service" ON processing_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_update_service" ON processing_queue FOR UPDATE USING (true);

-- Initialize existing brands with proper config
UPDATE brands 
SET 
    is_active = true,
    company_size = CASE 
        WHEN name IN ('Unilever', 'Nestlé', 'Procter & Gamble', 'Coca-Cola', 'PepsiCo', 'Walmart', 'Amazon', 'Apple', 'Microsoft', 'Google', 'Meta') 
        THEN 'fortune_500'
        WHEN name IN ('Johnson & Johnson', 'General Mills', 'Kellogg', 'Mars', 'Kraft Heinz') 
        THEN 'large'
        ELSE 'medium'
    END,
    monitoring_config = jsonb_build_object(
        'categories', ARRAY['labor', 'environment', 'compliance'],
        'priority', CASE 
            WHEN name IN ('Unilever', 'Nestlé', 'Procter & Gamble') 
            THEN 1
            ELSE 2
        END
    )
WHERE monitoring_config IS NULL;

-- Enqueue all active brands for initial processing
INSERT INTO processing_queue (brand_id, priority, scheduled_for, process_type, status)
SELECT 
    id,
    CASE company_size 
        WHEN 'fortune_500' THEN 1
        WHEN 'large' THEN 2
        ELSE 3
    END,
    now() + (random() * interval '1 hour'),
    'news_ingestion',
    'pending'
FROM brands
WHERE is_active = true
ON CONFLICT DO NOTHING;
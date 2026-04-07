
-- Create reservoir_signals table
CREATE TABLE public.reservoir_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('recall_pattern', 'violation_pattern', 'certification_signal')),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  category TEXT,
  dimension TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (signal_type, brand_id, dimension)
);

-- Create reservoir_adjustments table
CREATE TABLE public.reservoir_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  adjustment DOUBLE PRECISION NOT NULL DEFAULT 0,
  signals_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reservoir_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservoir_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated can read, service role writes
CREATE POLICY "Anyone can view reservoir signals"
  ON public.reservoir_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view reservoir adjustments"
  ON public.reservoir_adjustments FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon to read (for scan results without login)
CREATE POLICY "Anon can view reservoir signals"
  ON public.reservoir_signals FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can view reservoir adjustments"
  ON public.reservoir_adjustments FOR SELECT
  TO anon
  USING (true);

-- Indexes
CREATE INDEX idx_reservoir_signals_brand ON public.reservoir_signals(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_reservoir_signals_category ON public.reservoir_signals(category) WHERE category IS NOT NULL;
CREATE INDEX idx_reservoir_adjustments_brand ON public.reservoir_adjustments(brand_id);
CREATE INDEX idx_reservoir_adjustments_computed ON public.reservoir_adjustments(computed_at DESC);

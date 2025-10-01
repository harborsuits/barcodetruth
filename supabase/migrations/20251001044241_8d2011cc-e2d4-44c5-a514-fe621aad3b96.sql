-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create app_role enum if not exists
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create verification enum
CREATE TYPE verification_level AS ENUM ('unverified', 'corroborated', 'official');

-- Create orientation enum
CREATE TYPE event_orientation AS ENUM ('positive', 'negative', 'mixed');

-- Create category enum
CREATE TYPE event_category AS ENUM ('labor', 'environment', 'politics', 'social', 'cultural-values', 'general');

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table (for barcode resolution)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sources credibility table
CREATE TABLE IF NOT EXISTS source_credibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  base_credibility DECIMAL(3,2) NOT NULL CHECK (base_credibility >= 0 AND base_credibility <= 1),
  dynamic_adjustment DECIMAL(3,2) DEFAULT 0 CHECK (dynamic_adjustment >= -0.2 AND dynamic_adjustment <= 0.2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Brand events table (immutable append-only)
CREATE TABLE IF NOT EXISTS brand_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category event_category NOT NULL DEFAULT 'general',
  title TEXT,
  description TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe')),
  verified BOOLEAN DEFAULT false,
  verification verification_level DEFAULT 'unverified',
  orientation event_orientation,
  
  -- Impact on slider scores (nullable, partial)
  impact_labor INTEGER,
  impact_environment INTEGER,
  impact_politics INTEGER,
  impact_social INTEGER,
  
  jurisdiction TEXT,
  resolved BOOLEAN DEFAULT false,
  company_response_summary TEXT,
  company_response_url TEXT,
  company_response_date TIMESTAMPTZ,
  
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event sources junction table (one event, multiple sources)
CREATE TABLE IF NOT EXISTS event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES brand_events(event_id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_date TIMESTAMPTZ,
  quote TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Brand scores table (current slider scores per brand)
CREATE TABLE IF NOT EXISTS brand_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  score_labor INTEGER NOT NULL DEFAULT 50 CHECK (score_labor >= 0 AND score_labor <= 100),
  score_environment INTEGER NOT NULL DEFAULT 50 CHECK (score_environment >= 0 AND score_environment <= 100),
  score_politics INTEGER NOT NULL DEFAULT 50 CHECK (score_politics >= 0 AND score_politics <= 100),
  score_social INTEGER NOT NULL DEFAULT 50 CHECK (score_social >= 0 AND score_social <= 100),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles table (admin access control)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Indexes for performance
CREATE INDEX idx_brand_events_brand_id ON brand_events(brand_id);
CREATE INDEX idx_brand_events_category ON brand_events(category);
CREATE INDEX idx_brand_events_verification ON brand_events(verification);
CREATE INDEX idx_brand_events_date ON brand_events(event_date DESC);
CREATE INDEX idx_event_sources_event_id ON event_sources(event_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);

-- Enable Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_credibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read for all data (consumer app)
CREATE POLICY "Public read brands" ON brands FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read source_credibility" ON source_credibility FOR SELECT USING (true);
CREATE POLICY "Public read brand_events" ON brand_events FOR SELECT USING (true);
CREATE POLICY "Public read event_sources" ON event_sources FOR SELECT USING (true);
CREATE POLICY "Public read brand_scores" ON brand_scores FOR SELECT USING (true);

-- Admin-only write policies (for ingestion pipeline)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS for user_roles table
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin write policies
CREATE POLICY "Admins can insert brands" ON brands FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update brands" ON brands FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete brands" ON brands FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert products" ON products FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON products FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage source credibility" ON source_credibility FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert events" ON brand_events FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update events" ON brand_events FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert event sources" ON event_sources FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage brand scores" ON brand_scores FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update brand_scores.last_updated when scores change
CREATE OR REPLACE FUNCTION update_brand_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_scores_updated_at
  BEFORE UPDATE ON brand_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_scores_updated_at();

-- Function to get credibility score for a source
CREATE OR REPLACE FUNCTION get_source_credibility(source_name_param TEXT)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  credibility DECIMAL(3,2);
BEGIN
  SELECT COALESCE(base_credibility + dynamic_adjustment, 0.50)
  INTO credibility
  FROM source_credibility
  WHERE source_name = source_name_param;
  
  -- Default credibility if not found
  IF credibility IS NULL THEN
    credibility := 0.50;
  END IF;
  
  RETURN credibility;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed source credibility data
INSERT INTO source_credibility (source_name, base_credibility, notes) VALUES
  ('Federal Election Commission', 1.00, 'Official US government filing'),
  ('OSHA', 1.00, 'Official US labor regulator'),
  ('EPA', 1.00, 'Official US environmental regulator'),
  ('Reuters', 0.95, 'Top-tier wire service'),
  ('AP News', 0.95, 'Top-tier wire service'),
  ('Bloomberg', 0.90, 'Major financial news outlet'),
  ('The Guardian', 0.90, 'Major international outlet'),
  ('New York Times', 0.90, 'Major national outlet'),
  ('Washington Post', 0.85, 'Major national outlet'),
  ('ProPublica', 0.90, 'Investigative nonprofit'),
  ('CNN', 0.80, 'Major cable news'),
  ('ILO', 0.85, 'International Labor Organization'),
  ('Environmental Working Group', 0.80, 'NGO')
ON CONFLICT (source_name) DO NOTHING;
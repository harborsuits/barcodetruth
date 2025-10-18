-- Add missing user preference columns for weighted scoring
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS w_labor DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS w_environment DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS w_politics DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS w_social DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS w_verified DECIMAL(3,2) DEFAULT 1.0;

-- Add constraints to keep weights reasonable
ALTER TABLE public.user_preferences
ADD CONSTRAINT w_labor_range CHECK (w_labor BETWEEN 0 AND 2),
ADD CONSTRAINT w_environment_range CHECK (w_environment BETWEEN 0 AND 2),
ADD CONSTRAINT w_politics_range CHECK (w_politics BETWEEN 0 AND 2),
ADD CONSTRAINT w_social_range CHECK (w_social BETWEEN 0 AND 2),
ADD CONSTRAINT w_verified_range CHECK (w_verified BETWEEN 0 AND 2);
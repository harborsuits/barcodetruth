-- Add identity confidence tracking to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS canonical_domain TEXT,
ADD COLUMN IF NOT EXISTS identity_confidence TEXT DEFAULT 'low' CHECK (identity_confidence IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS identity_notes TEXT;

-- Add index for querying by confidence
CREATE INDEX IF NOT EXISTS idx_brands_identity_confidence ON public.brands(identity_confidence);

-- Comment for clarity
COMMENT ON COLUMN public.brands.canonical_domain IS 'Official domain for this brand (e.g., tesco.com), used for entity validation';
COMMENT ON COLUMN public.brands.identity_confidence IS 'Confidence level in entity resolution: low (name-only), medium (domain/alias match), high (verified QID/manual)';
COMMENT ON COLUMN public.brands.identity_notes IS 'Notes about identity resolution issues or manual corrections';
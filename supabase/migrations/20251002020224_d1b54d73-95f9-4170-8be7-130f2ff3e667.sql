-- Add unique constraint to prevent duplicate ownership relationships
ALTER TABLE public.brand_ownerships
ADD CONSTRAINT brand_ownerships_unique_relationship 
UNIQUE (brand_id, parent_brand_id, relationship_type);

-- Add index on wikidata_qid for faster lookups during seeding
CREATE INDEX IF NOT EXISTS idx_brands_wikidata_qid 
ON public.brands(wikidata_qid) 
WHERE wikidata_qid IS NOT NULL;
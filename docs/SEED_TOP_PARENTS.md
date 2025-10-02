# Seeding Top Parent Companies

This guide shows how to quickly seed the top 50-100 parent companies that cover most consumer shelf space.

## Quick Seed Script

Use this template to insert ownership relationships. Run via Supabase SQL Editor or as a migration:

```sql
-- Step 1: Insert parent companies if they don't exist
INSERT INTO public.brands (name, wikidata_qid, website)
VALUES
  ('Ahold Delhaize', 'Q1842079', 'https://www.aholddelhaize.com'),
  ('Kroger', 'Q153190', 'https://www.thekrogerco.com'),
  ('Albertsons', 'Q4711282', 'https://www.albertsonscompanies.com'),
  ('Costco', 'Q715583', 'https://www.costco.com'),
  ('Walmart', 'Q483551', 'https://www.walmart.com'),
  ('Target', 'Q1046215', 'https://www.target.com'),
  ('Nestlé', 'Q160746', 'https://www.nestle.com'),
  ('Unilever', 'Q157062', 'https://www.unilever.com'),
  ('Procter & Gamble', 'Q565594', 'https://www.pg.com'),
  ('PepsiCo', 'Q334800', 'https://www.pepsico.com'),
  ('Coca-Cola', 'Q3295867', 'https://www.coca-colacompany.com'),
  ('Kellogg Company', 'Q629115', 'https://www.kellanova.com'),
  ('Mondelez International', 'Q1345707', 'https://www.mondelezinternational.com'),
  ('General Mills', 'Q1278444', 'https://www.generalmills.com'),
  ('Mars Inc.', 'Q152822', 'https://www.mars.com'),
  ('Danone', 'Q190873', 'https://www.danone.com'),
  ('Johnson & Johnson', 'Q159852', 'https://www.jnj.com'),
  ('Colgate-Palmolive', 'Q583490', 'https://www.colgatepalmolive.com'),
  ('Reckitt', 'Q781999', 'https://www.reckitt.com'),
  ('L''Oréal', 'Q156574', 'https://www.loreal.com'),
  ('Kimberly-Clark', 'Q1746181', 'https://www.kimberly-clark.com'),
  ('Clorox', 'Q1101149', 'https://www.thecloroxcompany.com'),
  ('SC Johnson', 'Q1042180', 'https://www.scjohnson.com'),
  ('Henkel', 'Q218383', 'https://www.henkel.com')
ON CONFLICT (name) DO NOTHING;

-- Step 2: Link store brands to their parent retailers
-- Example: Hannaford → Ahold Delhaize
DO $$
DECLARE
  hannaford_id UUID;
  ahold_id UUID;
BEGIN
  -- Get brand IDs
  SELECT id INTO hannaford_id FROM brands WHERE name = 'Hannaford';
  SELECT id INTO ahold_id FROM brands WHERE name = 'Ahold Delhaize';
  
  -- Insert ownership edge
  IF hannaford_id IS NOT NULL AND ahold_id IS NOT NULL THEN
    INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source, source_url, confidence)
    VALUES (hannaford_id, ahold_id, 'brand_of', 'Wikidata', 'https://www.wikidata.org/wiki/Q1842079', 95)
    ON CONFLICT (brand_id, parent_brand_id, relationship_type) DO NOTHING;
  END IF;
END $$;

-- Step 3: Link national brands to their parents
-- Example: Ben & Jerry's → Unilever
DO $$
DECLARE
  bj_id UUID;
  unilever_id UUID;
BEGIN
  SELECT id INTO bj_id FROM brands WHERE name ILIKE '%Ben%Jerry%';
  SELECT id INTO unilever_id FROM brands WHERE name = 'Unilever';
  
  IF bj_id IS NOT NULL AND unilever_id IS NOT NULL THEN
    INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source, source_url, confidence)
    VALUES (bj_id, unilever_id, 'subsidiary_of', 'Wikidata', 'https://www.wikidata.org/wiki/Q157062', 95)
    ON CONFLICT (brand_id, parent_brand_id, relationship_type) DO NOTHING;
  END IF;
END $$;
```

## Batch Seed Template

For batch seeding many relationships at once:

```sql
-- Create a temp mapping table
CREATE TEMP TABLE ownership_seed (
  brand_name TEXT,
  parent_name TEXT,
  relationship_type ownership_relation,
  wikidata_qid TEXT,
  confidence INT
);

-- Insert all mappings
INSERT INTO ownership_seed VALUES
  ('Hannaford', 'Ahold Delhaize', 'brand_of', 'Q1842079', 95),
  ('Food Lion', 'Ahold Delhaize', 'brand_of', 'Q1842079', 95),
  ('Stop & Shop', 'Ahold Delhaize', 'brand_of', 'Q1842079', 95),
  ('Giant Food', 'Ahold Delhaize', 'brand_of', 'Q1842079', 95),
  ('Fred Meyer', 'Kroger', 'brand_of', 'Q153190', 95),
  ('Ralphs', 'Kroger', 'brand_of', 'Q153190', 95),
  ('Smith''s', 'Kroger', 'brand_of', 'Q153190', 95),
  ('Harris Teeter', 'Kroger', 'brand_of', 'Q153190', 95),
  ('Safeway', 'Albertsons', 'brand_of', 'Q4711282', 95),
  ('Vons', 'Albertsons', 'brand_of', 'Q4711282', 95),
  ('Jewel-Osco', 'Albertsons', 'brand_of', 'Q4711282', 95),
  ('Ben & Jerry''s', 'Unilever', 'subsidiary_of', 'Q157062', 95),
  ('Dove', 'Unilever', 'brand_of', 'Q157062', 95),
  ('Hellmann''s', 'Unilever', 'brand_of', 'Q157062', 95),
  ('Lipton', 'Unilever', 'brand_of', 'Q157062', 95),
  ('Tide', 'Procter & Gamble', 'brand_of', 'Q565594', 95),
  ('Pampers', 'Procter & Gamble', 'brand_of', 'Q565594', 95),
  ('Gillette', 'Procter & Gamble', 'brand_of', 'Q565594', 95),
  ('Crest', 'Procter & Gamble', 'brand_of', 'Q565594', 95),
  ('Lay''s', 'PepsiCo', 'brand_of', 'Q334800', 95),
  ('Doritos', 'PepsiCo', 'brand_of', 'Q334800', 95),
  ('Mountain Dew', 'PepsiCo', 'brand_of', 'Q334800', 95),
  ('Gatorade', 'PepsiCo', 'brand_of', 'Q334800', 95),
  ('Sprite', 'Coca-Cola', 'brand_of', 'Q3295867', 95),
  ('Fanta', 'Coca-Cola', 'brand_of', 'Q3295867', 95),
  ('Minute Maid', 'Coca-Cola', 'brand_of', 'Q3295867', 95),
  ('Dasani', 'Coca-Cola', 'brand_of', 'Q3295867', 95);

-- Bulk insert into brand_ownerships
INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source, source_url, confidence)
SELECT 
  b.id,
  p.id,
  s.relationship_type,
  'Wikidata',
  'https://www.wikidata.org/wiki/' || s.wikidata_qid,
  s.confidence
FROM ownership_seed s
JOIN brands b ON LOWER(b.name) = LOWER(s.brand_name)
JOIN brands p ON LOWER(p.name) = LOWER(s.parent_name)
ON CONFLICT (brand_id, parent_brand_id, relationship_type) DO NOTHING;

-- Clean up
DROP TABLE ownership_seed;
```

## Top 100 Parent Companies to Seed

**Grocery & Food Retail:**
- Ahold Delhaize (Hannaford, Food Lion, Stop & Shop, Giant)
- Kroger (Fred Meyer, Ralphs, Smith's, Harris Teeter)
- Albertsons (Safeway, Vons, Jewel-Osco, Acme)
- Costco (Kirkland Signature)
- Walmart (Great Value, Sam's Choice, Equate)
- Target (Good & Gather, Market Pantry, Up & Up)
- Aldi (Aldi brands)
- Trader Joe's (all private label)

**Food & Beverage:**
- Nestlé (KitKat, DiGiorno, Häagen-Dazs, Poland Spring, Nescafé)
- Unilever (Ben & Jerry's, Hellmann's, Dove, Lipton, Breyers)
- PepsiCo (Lay's, Doritos, Mountain Dew, Gatorade, Quaker)
- Coca-Cola (Sprite, Fanta, Minute Maid, Dasani, Honest Tea)
- Kellogg/Kellanova (Pringles, Cheez-It, Pop-Tarts, Rice Krispies)
- Mondelez (Oreo, Cadbury, Ritz, Triscuit, Toblerone)
- General Mills (Cheerios, Yoplait, Nature Valley, Pillsbury)
- Mars (M&M's, Snickers, Uncle Ben's, Pedigree)
- Danone (Dannon, Oikos, Activia, Evian)
- Kraft Heinz (Oscar Mayer, Philadelphia, Kraft Mac & Cheese)

**Consumer Goods:**
- Procter & Gamble (Tide, Pampers, Gillette, Crest, Bounty, Charmin)
- Johnson & Johnson (Band-Aid, Listerine, Neutrogena, Aveeno)
- Colgate-Palmolive (Colgate, Palmolive, Softsoap, Irish Spring)
- Reckitt (Lysol, Finish, Air Wick, Durex)
- L'Oréal (Garnier, Maybelline, Essie, CeraVe)
- Kimberly-Clark (Kleenex, Huggies, Scott, Cottonelle)
- Clorox (Clorox, Brita, Glad, Hidden Valley)
- SC Johnson (Windex, Pledge, Glade, Raid, Ziploc)
- Henkel (Dial, Persil, Right Guard)

## Validation Query

After seeding, check coverage:

```sql
SELECT
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  ))::float / NULLIF(COUNT(*), 0) * 100 AS pct_with_owner,
  COUNT(*) AS total_brands,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM brand_ownerships bo WHERE bo.brand_id = b.id
  )) AS brands_with_owner
FROM brands b;
```

Target: >50% coverage after seeding top parents.

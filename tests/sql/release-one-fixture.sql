-- Synthetic records, only for a disposable database with no network access.
CREATE EXTENSION pg_trgm;
CREATE EXTENSION unaccent;
CREATE TABLE public.brands (id uuid PRIMARY KEY, name text, parent_company text, parent_company_id text,
  logo_url text, category_slug text, subcategory_slug text, is_active boolean, status text);
CREATE TABLE public.companies (id uuid PRIMARY KEY, company_type text);
CREATE TABLE public.brand_scores (brand_id uuid PRIMARY KEY, score numeric, score_environment numeric,
  score_labor numeric, score_politics numeric, score_social numeric);
CREATE TABLE public.products (id uuid PRIMARY KEY, name text, category text, brand_id uuid, barcode text, review_status text);
INSERT INTO companies VALUES ('10000000-0000-0000-0000-000000000001','private');
INSERT INTO brands VALUES
 ('00000000-0000-0000-0000-000000000001','Origin Tea','Owner A','10000000-0000-0000-0000-000000000001',null,'food','black-tea',true,'ready'),
 ('00000000-0000-0000-0000-000000000002','Candidate Tea','Owner B','malformed-legacy-text',null,'food','black-tea',true,'ready'),
 ('00000000-0000-0000-0000-000000000003','Same Owner Tea','Owner A','10000000-0000-0000-0000-000000000001',null,'food','black-tea',true,'ready'),
 ('00000000-0000-0000-0000-000000000004','Unknown Category',null,null,null,null,null,true,'ready'),
 ('00000000-0000-0000-0000-000000000005','Wrong Category Tea',null,null,null,'food','iced-tea',true,'ready'),
 ('00000000-0000-0000-0000-000000000006','Pending Tea',null,null,null,'food','black-tea',true,'stub');
INSERT INTO brand_scores VALUES ('00000000-0000-0000-0000-000000000002',null,null,null,null,null);
INSERT INTO products VALUES
 ('20000000-0000-0000-0000-000000000001','Tea approved','black-tea',null,'1111111111111','approved'),
 ('20000000-0000-0000-0000-000000000002','Tea pending','black-tea',null,'2222222222222','pending'),
 ('20000000-0000-0000-0000-000000000003','Tea rejected','black-tea',null,'3333333333333','rejected');
ALTER TABLE brands ADD COLUMN is_test boolean DEFAULT false;
INSERT INTO brands (id,name,category_slug,subcategory_slug,is_active,status,is_test) VALUES
 ('00000000-0000-0000-0000-000000000007','Test Tea','food','black-tea',true,'ready',true);

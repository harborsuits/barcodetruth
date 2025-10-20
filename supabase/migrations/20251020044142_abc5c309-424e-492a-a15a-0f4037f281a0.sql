-- Create category grouping views per spec

-- 1) Group dictionary (UI order)
CREATE OR REPLACE VIEW v_category_groups AS
SELECT *
FROM (VALUES
  ('Product Safety',   10),
  ('Regulatory',       20),
  ('Legal',            30),
  ('Labor',            40),
  ('Financial',        50),
  ('Policy',           60),
  ('ESG (Environment)',70),
  ('Social & Cultural',80),
  ('Noise',            90)
) AS t(group_name, group_order);

-- 2) Map category_code -> group_name
CREATE OR REPLACE VIEW v_category_map AS
SELECT * FROM (VALUES
  ('FIN.EARNINGS',          'Financial'),
  ('FIN.MARKETS',           'Financial'),
  ('FIN.MNA',               'Financial'),
  ('FIN.INSTITUTIONAL',     'Financial'),
  ('FIN.GENERAL',           'Financial'),
  ('PRODUCT.SAFETY',        'Product Safety'),
  ('PRODUCT.RECALL',        'Product Safety'),
  ('LEGAL.LITIGATION',      'Legal'),
  ('LEGAL.SETTLEMENT',      'Legal'),
  ('REGULATORY.ENFORCEMENT','Regulatory'),
  ('REGULATORY.FILING',     'Regulatory'),
  ('LABOR.PRACTICES',       'Labor'),
  ('LABOR.UNION',           'Labor'),
  ('ESG.ENVIRONMENT',       'ESG (Environment)'),
  ('ESG.SOCIAL',            'Social & Cultural'),
  ('SOC.CULTURE',           'Social & Cultural'),
  ('POLICY.PUBLIC',         'Policy'),
  ('NOISE.GENERAL',         'Noise')
) AS m(code, group_name);

-- 3) Unified feed view with stable ordering
CREATE OR REPLACE VIEW company_feed_grouped AS
SELECT
  e.*,
  cm.group_name,
  cg.group_order,
  CASE e.verification
    WHEN 'official'      THEN 1
    WHEN 'corroborated'  THEN 2
    ELSE 3
  END AS verification_rank
FROM company_profile_feed e
LEFT JOIN v_category_map cm ON cm.code = e.category_code
LEFT JOIN v_category_groups cg ON cg.group_name = cm.group_name;
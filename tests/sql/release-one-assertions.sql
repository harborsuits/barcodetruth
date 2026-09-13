DO $test$
DECLARE result jsonb; row record;
BEGIN
  SELECT * INTO STRICT row FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001', 12);
  ASSERT row.brand_name = 'Candidate Tea', 'wrong category, same parent or pending brand admitted';
  ASSERT row.score IS NULL AND row.score_labor IS NULL, 'missing scores fabricated';
  ASSERT row.alt_group = 'candidate' AND row.company_type = 'unknown', 'unsupported superiority or ownership';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000004', 12)) = 0, 'unknown category admitted';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000007', 12)) = 0, 'test source brand admitted';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001', 0)) = 0, 'zero limit ignored';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001', -1)) = 0, 'negative limit ignored';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001', 1)) = 1, 'limit one ignored';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001', NULL)) = 1, 'null limit failed';
  ASSERT (SELECT count(*) FROM public.get_smart_alternatives('00000000-0000-0000-0000-000000000001', 100000)) <= 12, 'oversized limit failed';
  result := public.search_catalog('Tea', 20);
  ASSERT jsonb_array_length(result->'products') = 1, 'pending or rejected product leaked';
  ASSERT jsonb_array_length(result->'brands') = 4, 'ready brand missing or pending brand published';
  ASSERT jsonb_array_length(public.search_catalog('',20)->'products') = 0, 'empty search returns records';
  ASSERT jsonb_array_length(public.search_catalog('Tea',-1)->'brands') = 0, 'negative search limit ignored';
  ASSERT jsonb_array_length(public.search_catalog('Tea',1)->'brands') = 1, 'search limit ignored';
END;
$test$;
SELECT 'release-one SQL assertions passed' AS result;

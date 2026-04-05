
-- Clear wrong descriptions and wikidata_qid for all 26 entity-mismatched brands
-- These are real consumer brands that got matched to wrong Wikipedia entities (villages, films, lakes, etc.)

UPDATE brands SET 
  description = NULL,
  wikidata_qid = NULL
WHERE id IN (
  'e2889100-88c9-4dbf-8b8d-948e1d69fb49', -- Ain atlas
  'bcad95cc-9772-450a-81e3-f100d112212a', -- Aunt Fannie's
  '5340fc98-a8c2-4562-b585-5449d4cc815a', -- BETTER OATS
  '793d7854-0fea-45a4-91d2-fe1da67fab55', -- Boulder Canyon
  'f12c0f08-d73c-4251-baa9-8b7350708253', -- BRAGG
  'dd8bc670-b681-40a3-8811-d939d5b05e02', -- CUVECO AS
  'adfb8e7a-392f-49d2-8758-33eada861936', -- dm Bio
  '7c8381d0-5c0e-428b-a20b-83207d75ff06', -- Garden of Life
  '691591c1-4a66-4791-a0c4-e8554d1b0416', -- Good & Gather
  'efc648eb-7a72-40b7-997e-4dc1bbfcad4d', -- Ice Mountain
  '1843d867-08ad-4bfc-9109-0101d9799c38', -- La Banderita
  'af0a17b7-4835-4c0b-80f6-245412ff9888', -- La Dolce Vita
  'a9e11b8f-dc13-45ef-9aec-a28968fe7340', -- La Panzanella
  '175b22b0-92f8-40ce-8a07-a164b72c99ef', -- Louisiana
  '0679bcf5-8654-45d2-9d04-fe2cbbfc910d', -- Mccormick & Co. Inc.
  'ac7daa07-5e36-4d20-b181-0c1a630bb6b2', -- México Lindo
  'de4a004d-95fe-44f7-a90d-ed90966c91ca', -- Millville
  'b550f3cf-69c3-4a29-b0cf-a8550429e5b4', -- Milton's
  'b91c0d27-caf9-4f45-b423-31233c2616d2', -- PANDA EXPRESS
  '444f8f09-2bb1-4ae4-be9c-1b76260a1157', -- Seiyu Group
  '1ad414dc-89b4-4f74-903b-1d50fe778ef1', -- Seven Sundays
  'b51f8a93-7a7d-46a7-8862-40922627a137', -- sidi ali
  'd3eb6936-7bbe-43ce-8b83-f7ba09a4fafa', -- SKY VALLEY
  'd394d141-1a0b-47ae-b18b-0c0ba7e2a235', -- Soules Kitchen
  'ed2da72f-35a7-4553-8590-e2f77bb665ec', -- TRUE lemon
  'd587a2d6-b408-478c-b430-a064e3aad49c'  -- Zephyrhills
);

-- Mark all 26 issues as resolved
UPDATE brand_enrichment_issues 
SET resolved_at = now()
WHERE issue_type = 'entity_mismatch' 
  AND severity = 'critical' 
  AND resolved_at IS NULL;

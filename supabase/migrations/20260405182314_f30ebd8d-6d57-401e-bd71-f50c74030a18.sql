
-- Add websites to top brands missing logos so the batch logo resolver can find them
UPDATE brands SET website = CASE id
  WHEN 'fc65129c-56b6-43ab-a755-6d710f270dc7' THEN 'kirkland.costco.com'
  WHEN '7d1eae70-6d34-48be-b1d2-032305701fe2' THEN 'walmart.com'
  WHEN '61f59c3b-b6c4-4797-849b-db3c557a63d8' THEN 'kindsnacks.com'
  WHEN 'd69d46f4-df6f-4603-bd69-a69519e6ab19' THEN 'jaouda.com'
  WHEN '50f3d8ca-44ec-4246-a377-1da861d57325' THEN 'nabisco.com'
  WHEN '8c922ef5-4cfe-405c-ba1a-c8cc5b5178c0' THEN 'haagendazs.us'
  WHEN '8a071f83-c276-44d9-810f-9af7fa1eba3b' THEN 'oikosyogurt.com'
  WHEN 'ca405373-cead-40c5-82af-f3dde2b76103' THEN 'aldi.us'
  WHEN '40a63f57-21bc-4e3d-8503-311bd7d8cfc3' THEN 'sietefoods.com'
  WHEN 'ffae4e10-a8f8-45c6-8cdc-d350b29c3116' THEN 'aldi.us'
  WHEN '54cc458d-6c2b-4871-9aa9-5f79ac78c01c' THEN 'naturevalley.com'
  WHEN '6e999e5d-62ae-4c67-874d-cd79fe6b2abb' THEN 'samsclub.com'
  WHEN 'b9160944-6277-4fa1-9b97-a15b65b34299' THEN 'silk.com'
  WHEN '29514672-58df-47e2-96d9-0954f4a1da40' THEN 'postconsumerbrands.com'
  WHEN '0087cd67-77f7-4aaf-8180-8e079752d5fd' THEN 'simplemills.com'
  WHEN 'd0db8b70-bfcf-47fe-b3aa-3e3231140fe6' THEN 'primalkitchen.com'
  WHEN '9b849179-4f42-4029-a473-379ea2caf9dd' THEN 'drinkolipop.com'
  WHEN '25af998a-7893-486e-afae-eba21f5fc3b7' THEN 'purelyelizabeth.com'
  WHEN 'a47101c6-27f5-46b2-a3e4-d5c219ae5730' THEN 'morningstarfarms.com'
  WHEN '5f02c94e-ecc1-4280-b90d-58d573e1a522' THEN 'bolthouse.com'
  WHEN '351e8cc7-1dc9-4d48-8a0f-085b5b82b0e3' THEN 'lkk.com'
  WHEN '6995bcf7-ad51-4175-abdb-60fee2077642' THEN 'bluediamond.com'
  WHEN 'd023dd3b-99b5-4499-ba37-277944772562' THEN 'celsius.com'
  WHEN '19b18567-479a-4379-bda1-818372300d14' THEN 'bobsredmill.com'
  WHEN '1e78f6b8-ad15-44d6-aa9b-326f9947fcc1' THEN 'drinkbodyarmor.com'
  WHEN '54a76ba1-fe26-41c1-9090-a163df6d3e40' THEN 'kashi.com'
  WHEN 'bf9c491a-7805-4d1e-ad11-20899e2bebdf' THEN 'oceanspray.com'
  WHEN '442d11cd-ebfc-4327-8835-2e738ccf23cf' THEN 'naturespath.com'
  WHEN '7c3ec423-5bce-4cd8-8aa2-31de74b1c993' THEN 'daisybrand.com'
  WHEN '40fc91fd-5903-4481-ac3f-4c541a1f7150' THEN 'talentigelato.com'
  WHEN '80256e09-fa57-41e8-9b16-13b31fd4bf42' THEN 'pringles.com'
  WHEN 'd420805a-11a4-47ff-a16e-add781813317' THEN 'drinkpoppi.com'
  WHEN 'a1296464-4cba-4ff3-a7c2-8e30a8772bd9' THEN 'triscuit.com'
  WHEN '389084ea-0188-40ea-bcf4-9fd61cddb249' THEN 'raos.com'
  WHEN '9e889a23-ea1d-4682-a1c1-7f72d2282446' THEN 'siggis.com'
  WHEN 'b2c88f36-7851-415d-bbfd-203063d1051e' THEN 'kirkland.costco.com'
END
WHERE id IN (
  'fc65129c-56b6-43ab-a755-6d710f270dc7', '7d1eae70-6d34-48be-b1d2-032305701fe2',
  '61f59c3b-b6c4-4797-849b-db3c557a63d8', 'd69d46f4-df6f-4603-bd69-a69519e6ab19',
  '50f3d8ca-44ec-4246-a377-1da861d57325', '8c922ef5-4cfe-405c-ba1a-c8cc5b5178c0',
  '8a071f83-c276-44d9-810f-9af7fa1eba3b', 'ca405373-cead-40c5-82af-f3dde2b76103',
  '40a63f57-21bc-4e3d-8503-311bd7d8cfc3', 'ffae4e10-a8f8-45c6-8cdc-d350b29c3116',
  '54cc458d-6c2b-4871-9aa9-5f79ac78c01c', '6e999e5d-62ae-4c67-874d-cd79fe6b2abb',
  'b9160944-6277-4fa1-9b97-a15b65b34299', '29514672-58df-47e2-96d9-0954f4a1da40',
  '0087cd67-77f7-4aaf-8180-8e079752d5fd', 'd0db8b70-bfcf-47fe-b3aa-3e3231140fe6',
  '9b849179-4f42-4029-a473-379ea2caf9dd', '25af998a-7893-486e-afae-eba21f5fc3b7',
  'a47101c6-27f5-46b2-a3e4-d5c219ae5730', '5f02c94e-ecc1-4280-b90d-58d573e1a522',
  '351e8cc7-1dc9-4d48-8a0f-085b5b82b0e3', '6995bcf7-ad51-4175-abdb-60fee2077642',
  'd023dd3b-99b5-4499-ba37-277944772562', '19b18567-479a-4379-bda1-818372300d14',
  '1e78f6b8-ad15-44d6-aa9b-326f9947fcc1', '54a76ba1-fe26-41c1-9090-a163df6d3e40',
  'bf9c491a-7805-4d1e-ad11-20899e2bebdf', '442d11cd-ebfc-4327-8835-2e738ccf23cf',
  '7c3ec423-5bce-4cd8-8aa2-31de74b1c993', '40fc91fd-5903-4481-ac3f-4c541a1f7150',
  '80256e09-fa57-41e8-9b16-13b31fd4bf42', 'd420805a-11a4-47ff-a16e-add781813317',
  'a1296464-4cba-4ff3-a7c2-8e30a8772bd9', '389084ea-0188-40ea-bcf4-9fd61cddb249',
  '9e889a23-ea1d-4682-a1c1-7f72d2282446', 'b2c88f36-7851-415d-bbfd-203063d1051e'
);

-- Also clear logo_last_checked so the batch resolver picks them up fresh
UPDATE brands SET logo_last_checked = NULL
WHERE id IN (
  'fc65129c-56b6-43ab-a755-6d710f270dc7', '7d1eae70-6d34-48be-b1d2-032305701fe2',
  '61f59c3b-b6c4-4797-849b-db3c557a63d8', 'd69d46f4-df6f-4603-bd69-a69519e6ab19',
  '50f3d8ca-44ec-4246-a377-1da861d57325', '8c922ef5-4cfe-405c-ba1a-c8cc5b5178c0',
  '8a071f83-c276-44d9-810f-9af7fa1eba3b', 'ca405373-cead-40c5-82af-f3dde2b76103',
  '40a63f57-21bc-4e3d-8503-311bd7d8cfc3', 'ffae4e10-a8f8-45c6-8cdc-d350b29c3116',
  '54cc458d-6c2b-4871-9aa9-5f79ac78c01c', '6e999e5d-62ae-4c67-874d-cd79fe6b2abb',
  'b9160944-6277-4fa1-9b97-a15b65b34299', '29514672-58df-47e2-96d9-0954f4a1da40',
  '0087cd67-77f7-4aaf-8180-8e079752d5fd', 'd0db8b70-bfcf-47fe-b3aa-3e3231140fe6',
  '9b849179-4f42-4029-a473-379ea2caf9dd', '25af998a-7893-486e-afae-eba21f5fc3b7',
  'a47101c6-27f5-46b2-a3e4-d5c219ae5730', '5f02c94e-ecc1-4280-b90d-58d573e1a522',
  '351e8cc7-1dc9-4d48-8a0f-085b5b82b0e3', '6995bcf7-ad51-4175-abdb-60fee2077642',
  'd023dd3b-99b5-4499-ba37-277944772562', '19b18567-479a-4379-bda1-818372300d14',
  '1e78f6b8-ad15-44d6-aa9b-326f9947fcc1', '54a76ba1-fe26-41c1-9090-a163df6d3e40',
  'bf9c491a-7805-4d1e-ad11-20899e2bebdf', '442d11cd-ebfc-4327-8835-2e738ccf23cf',
  '7c3ec423-5bce-4cd8-8aa2-31de74b1c993', '40fc91fd-5903-4481-ac3f-4c541a1f7150',
  '80256e09-fa57-41e8-9b16-13b31fd4bf42', 'd420805a-11a4-47ff-a16e-add781813317',
  'a1296464-4cba-4ff3-a7c2-8e30a8772bd9', '389084ea-0188-40ea-bcf4-9fd61cddb249',
  '9e889a23-ea1d-4682-a1c1-7f72d2282446', 'b2c88f36-7851-415d-bbfd-203063d1051e',
  '36c24b69-177f-49ec-9006-4381b5b81f59', '272ee910-f436-439e-9002-4e432969732e',
  '7d48256c-aa15-44f6-81f6-c54383a54984', 'a53d0cac-8292-48ba-bc35-009324ea5aa8',
  '16ce8d06-09ab-4d6b-bbd4-2cab52c9fb12', '9ecbd199-d856-46e7-a14c-bef603c4fd45',
  '3a0d71e6-5809-4a33-b1d3-1cbd9f7832b1', '5d834769-a57c-475d-85f2-0489868e81bc',
  '95e81a6c-042d-4fb5-8ee6-3526545509c6', 'b315e700-aa62-4a1a-9ee4-57615bcb3518',
  '49d9f426-0e4b-4cc7-9954-373d31a2577b', '50bf734d-429f-4749-b280-f5e6ee873aa4',
  '3a232e09-5965-4732-830d-486491a6165d', 'ed2553c1-8196-47eb-91bf-830943d40b5f'
);

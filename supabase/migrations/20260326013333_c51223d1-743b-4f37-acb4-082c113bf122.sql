
-- Backfill logos for 6 missing brands using Clearbit/known sources
UPDATE brands SET logo_url = 'https://logo.clearbit.com/churchdwight.com' WHERE id = '630e5af0-9f8f-40fb-98dd-a8c971e79cb4' AND (logo_url IS NULL OR logo_url = '');
UPDATE brands SET logo_url = 'https://logo.clearbit.com/colgatepalmolive.com' WHERE id = '3a7ee66f-a267-448b-a209-a04935637a67' AND (logo_url IS NULL OR logo_url = '');
UPDATE brands SET logo_url = 'https://logo.clearbit.com/lifescan.com' WHERE id = '096758ff-770a-44dc-ac6e-2ef3fdd07b6b' AND (logo_url IS NULL OR logo_url = '');
UPDATE brands SET logo_url = 'https://logo.clearbit.com/lindt.com' WHERE id = 'c5104c94-ec2a-4bc7-b872-91ce7a0ccc78' AND (logo_url IS NULL OR logo_url = '');
UPDATE brands SET logo_url = 'https://logo.clearbit.com/readyfoods.com' WHERE id = '0257d5ff-61a8-4881-bec3-d9457c4701f0' AND (logo_url IS NULL OR logo_url = '');
UPDATE brands SET logo_url = 'https://logo.clearbit.com/sunshinefoods.com' WHERE id = '6585590f-01bf-415f-af93-e81264ec1623' AND (logo_url IS NULL OR logo_url = '');

-- Backfill websites for 32 brands missing them
UPDATE brands SET website = 'https://www.jnjmedtech.com/en-US/companies/acclarent' WHERE id = 'a1f7d6dc-a793-40c3-84d4-63343274d10e' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.aloha.com' WHERE id = '8e31f1d6-d37c-40ce-b695-f7ae4f6f2ec0' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.barilla.com' WHERE id = '9acf4228-38a6-428e-aaee-708524479fff' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.beyondmeat.com' WHERE id = 'e6ec0dcd-cdcf-46e0-b90a-2b70d52cf8d7' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.boots.com' WHERE id = 'd4f72c9c-6334-435c-aa61-715438557927' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.coca-cola.com' WHERE id = '808bb42f-c09d-47c9-b22a-2f39efe05691' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.delta.com' WHERE id = '122f0c2d-fb94-4633-9bda-be24131e9f65' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.jnjmedtech.com/en-US/companies/depuy-synthes' WHERE id = '37543999-8af3-4d21-bd5b-a217bab1c67f' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.drpepper.com' WHERE id = '2f823b24-9d0c-4a0c-8a3b-d99ed3661cea' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.fanta.com' WHERE id = '92c4c381-9c7a-46a7-bb19-ba0853b3913f' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.gerber.com' WHERE id = '258fba6c-1b2d-4f08-9496-d7521c70862f' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.greengiant.com' WHERE id = '8b455bd8-ce3c-4b9c-8474-30aff0c215de' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://hukitchen.com' WHERE id = 'b7b14369-5f0c-41ca-9449-5f13997fe603' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.janssen.com' WHERE id = 'ca6fc6bf-8103-4860-a6d1-c7892c82ad68' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.larabar.com' WHERE id = '4f72c225-b9cc-4d83-a5a9-42794a736532' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.lifescan.com' WHERE id = '096758ff-770a-44dc-ac6e-2ef3fdd07b6b' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.lindt.com' WHERE id = 'c5104c94-ec2a-4bc7-b872-91ce7a0ccc78' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.mccain.com' WHERE id = 'da4a6ed9-3a24-454b-8459-5cc9c5a6181b' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.morrisons.com' WHERE id = '87e7a1e7-52df-4c3d-a4e2-dc9276601b3f' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.neutrogena.com' WHERE id = 'aa6476b1-53e2-47ff-a527-60cf1df64d53' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.oasisdrinks.com' WHERE id = 'd7492f5b-7e74-4fe2-85b7-8b4df52c86c5' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.pepsi.com' WHERE id = '330dfb0f-ec9b-4bf1-8878-aea3882649e0' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.questnutrition.com' WHERE id = '666ff55d-d25d-40e1-8cc4-af9eda66444d' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.readyfoods.com' WHERE id = '0257d5ff-61a8-4881-bec3-d9457c4701f0' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.redbull.com' WHERE id = '255b4a09-3ec3-44c1-8001-d155ca0695d7' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.royalfoods.com' WHERE id = 'b5546d9d-36f5-48df-ae97-04e570c73420' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.schweppes.com' WHERE id = 'a91c3ec9-9e64-4c53-a34c-5f4cb67e383b' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.simplyorangejuice.com' WHERE id = 'f270f3c0-0610-49e3-b8ef-a2202c282967' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.peanutbutter.com' WHERE id = '66a4d1fa-b09f-4a66-bd38-5d91ed168122' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.sunshinefoods.com' WHERE id = '6585590f-01bf-415f-af93-e81264ec1623' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.terrachips.com' WHERE id = '14365bad-0ab1-44d9-87a6-fdd02e518312' AND (website IS NULL OR website = '');
UPDATE brands SET website = 'https://www.tesco.com' WHERE id = '2317f674-2d21-4a6d-afb7-fbb0ee3db89b' AND (website IS NULL OR website = '');

-- STEP 2: Disable the old cron job (ID 62)
SELECT cron.unschedule(62);
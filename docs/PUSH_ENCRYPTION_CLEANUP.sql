-- Push Notification Credential Encryption - Final Cleanup
-- ⚠️ ONLY RUN THIS AFTER VERIFYING ALL CREDENTIALS ARE ENCRYPTED ⚠️

-- Step 1: Check encryption status
SELECT * FROM public.check_push_encryption_status();

-- Expected result: encryption_complete = true, plaintext_count = 0

-- Step 2: Verify no plaintext remains (manual double-check)
SELECT 
  user_id,
  endpoint,
  (auth IS NOT NULL) as has_plaintext_auth,
  (p256dh IS NOT NULL) as has_plaintext_p256dh,
  (auth_enc_b64 IS NOT NULL) as has_encrypted_auth,
  (p256dh_enc_b64 IS NOT NULL) as has_encrypted_p256dh
FROM public.user_push_subs
WHERE auth IS NOT NULL OR p256dh IS NOT NULL;

-- Should return 0 rows

-- Step 3: Drop plaintext columns (ONLY IF ABOVE CHECKS PASS)
-- Uncomment and run these lines ONLY after verifying encryption is complete:

-- ALTER TABLE public.user_push_subs DROP COLUMN IF EXISTS auth;
-- ALTER TABLE public.user_push_subs DROP COLUMN IF EXISTS p256dh;

-- Step 4: Verify schema after cleanup
-- \d user_push_subs

-- Expected columns:
-- - id
-- - user_id
-- - endpoint
-- - auth_enc (bytea)
-- - p256dh_enc (bytea)
-- - auth_enc_b64 (text) ✓ Used for sending
-- - p256dh_enc_b64 (text) ✓ Used for sending
-- - ua
-- - created_at

# Push Notification Credential Encryption - Verification Guide

## Quick Verification Checklist

### 1. Check Encryption Status

```sql
SELECT * FROM public.check_push_encryption_status();
```

Expected output:
```
total_subs | encrypted_count | plaintext_count | encryption_complete
-----------|-----------------|-----------------|--------------------
    N      |       N         |       0         |       true
```

### 2. Test New Subscription Flow

Create a new push subscription using your app UI, then verify:

```sql
SELECT 
  user_id,
  endpoint,
  (auth IS NULL) as auth_scrubbed,
  (p256dh IS NULL) as p256dh_scrubbed,
  (auth_enc_b64 IS NOT NULL) as has_encrypted_auth,
  (p256dh_enc_b64 IS NOT NULL) as has_encrypted_p256dh,
  created_at
FROM user_push_subs
ORDER BY created_at DESC
LIMIT 5;
```

✅ Expected: `auth_scrubbed = true`, `p256dh_scrubbed = true`, both encrypted fields = `true`

### 3. Migrate Existing Data (Admin Only)

Call the migration function:

```bash
# Get your admin token (from your authenticated session)
# Then run:
curl -X POST https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/migrate-push-encryption \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "migrated": X,
  "skipped": Y,
  "total": X+Y
}
```

### 4. Verify No Plaintext Remains

```sql
SELECT COUNT(*) as remaining_plaintext
FROM user_push_subs
WHERE auth IS NOT NULL OR p256dh IS NOT NULL;
```

✅ Expected: `0`

### 5. Test Send Path

Send a test notification to verify decryption works:

```bash
curl -X POST https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {"endpoint": "...", "auth_enc_b64": "...", "p256dh_enc_b64": "..."},
    "brand_id": "test",
    "brand_name": "Test Brand",
    "category": "labor",
    "delta": 5
  }'
```

Check edge function logs for: `[send-push-notification] Using encrypted credentials`

### 6. Final Cleanup

Once all verifications pass, drop the plaintext columns:

```sql
-- See docs/PUSH_ENCRYPTION_CLEANUP.sql for the full cleanup script
ALTER TABLE public.user_push_subs DROP COLUMN IF EXISTS auth;
ALTER TABLE public.user_push_subs DROP COLUMN IF EXISTS p256dh;
```

## Security Best Practices Applied

✅ **AES-256-GCM encryption** with unique IV per encryption  
✅ **Versioned ciphertext** (`v1:`) for future key rotation  
✅ **Separate encryption key** from VAPID signing keys  
✅ **Text-based storage** (`*_b64`) for simpler handling  
✅ **RLS policies** restrict access to `auth.uid()` only  
✅ **No plaintext** in logs or responses  
✅ **Admin-only** migration function with role check  

## Key Rotation (Future)

The system supports key rotation via version prefixes:

1. Generate new `PUSH_ENC_KEY_V2`
2. Update functions to decrypt with v1, encrypt with v2
3. Run migration to re-encrypt all credentials
4. Update to v2-only decryption
5. Retire v1 key

## Troubleshooting

### "Missing both plaintext and encrypted credentials"
- Run the migration function to encrypt existing subscriptions
- Check that new subscriptions are writing to `*_enc_b64` columns

### Decryption fails
- Verify `PUSH_ENC_KEY` matches the key used to encrypt
- Check edge function logs for specific error messages
- Ensure base64 text format is correctly stored/retrieved

### Migration function returns 403
- Ensure the calling user has `admin` role in `user_roles` table
- Check authentication token is valid and not expired

## Current Status

Run this query to see the current security posture:

```sql
SELECT 
  'Encryption' as check_type,
  CASE 
    WHEN COUNT(*) FILTER (WHERE auth IS NOT NULL OR p256dh IS NOT NULL) = 0 THEN '✅ Complete'
    ELSE '⚠️ Pending'
  END as status,
  COUNT(*) as total_subscriptions,
  COUNT(*) FILTER (WHERE auth_enc_b64 IS NOT NULL) as encrypted,
  COUNT(*) FILTER (WHERE auth IS NOT NULL) as plaintext
FROM user_push_subs;
```

## Goal
Lock down the three active emergencies from the audit: the catalog self-destruct endpoint, the expensive public job endpoints, and the spam-vector submission endpoint. Then sweep `config.toml` so every mutating/cost-incurring function requires a JWT.

## Changes

### 1. `delete-brand-data` — immediate kill switch + proper gate
- `supabase/config.toml`: set `[functions.delete-brand-data] verify_jwt = true` (currently `false`).
- `supabase/functions/delete-brand-data/index.ts`: keep the existing `requireAdminOrInternal` check, but add a hard short-circuit at the top of the handler that returns `403 { error: "Disabled" }` unless an env flag `ENABLE_DELETE_BRAND_DATA=true` is set. Default = disabled. This neutralizes the wipe risk even if auth is ever misconfigured.

### 2. Expensive public jobs — require JWT at the gateway
Flip `verify_jwt = true` in `supabase/config.toml` for:
- `batch-process-brands`
- `recompute-brand-scores`
- `bulk-calculate-scores`
- `process-brand-stubs`
- `rotate-brand-ingestion`
- `auto-accept-claims`

These already have (or will get) `requireAdminOrInternal` in code, but the cron path uses `x-internal-token` + service-role Authorization header, which satisfies `verify_jwt = true`. So scheduled jobs keep working; anonymous curls get rejected at the gateway.

Add `requireAdminOrInternal` to `rotate-brand-ingestion/index.ts` (currently has no in-code auth check — only file in this list missing it).

### 3. `submit-unknown-product` — require login + tighten validation
- `supabase/config.toml`: set `[functions.submit-unknown-product] verify_jwt = true`.
- `supabase/functions/submit-unknown-product/index.ts`:
  - Extract user via `supabase.auth.getClaims(token)`; reject if no user.
  - Require submitted `userId` to equal `claims.sub` (or just use the claim and ignore the body field).
  - Validate `photo_url`: must be `null/empty` OR start with the project's storage public URL prefix (`${SUPABASE_URL}/storage/v1/object/public/` or signed URL prefix). Reject arbitrary `http(s)://...`.
  - Keep existing barcode/brand validation.

### 4. Config sweep (documentation only in this plan)
After the above, every remaining `verify_jwt = false` function in `config.toml` should be one of: public read (`get-product-by-barcode`, `search-brands`, `v1-brands`, `smart-product-lookup`, `scan-product`, `get-brand-sources`, `get-brand-proof`, `community-*`, `subscribe-push`/`unsubscribe-push`, `stripe-webhook`, external-source webhooks). No action this round, but flagged for a follow-up pass.

## Out of scope (intentionally deferred)
- SECURITY DEFINER views (#4) and privacy contact (#2) — user said these are next, not this round.
- Per-user rate limiting on `submit-unknown-product` — JWT requirement alone removes the day-one flood.
- Migrating `delete-brand-data` to a SQL-only operation — env-flag disable is the pragmatic stop-gap.

## Verification
- `supabase--curl_edge_functions` against `delete-brand-data` with no auth → expect 401 (gateway). With admin JWT and `ENABLE_DELETE_BRAND_DATA` unset → expect 403 `Disabled`.
- Curl `bulk-calculate-scores` with no auth → expect 401.
- Curl `submit-unknown-product` with no auth → expect 401; with a user JWT and a `photo_url` of `http://evil.example/x.jpg` → expect 400.

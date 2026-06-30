
## Goal
Get `barcodetruth.com` serving the app again. Right now the root URL returns 404, while the Lovable-hosted URLs (`barcodetruth.lovable.app`, preview) are expected to still work.

## Diagnosis plan (no code changes yet)

1. **Confirm scope of the 404**
   - Check `https://barcodetruth.com/` and `https://www.barcodetruth.com/` — both, or only one?
   - Check `https://barcodetruth.lovable.app/` — if this works, the build/app is fine and the issue is domain/DNS/edge routing, not code.
   - Check a deep link (e.g. `/scan`) on the custom domain — if root 404s but deep links also 404 with a Lovable-styled 404, it's a routing-layer issue; if it's a generic registrar/host 404 page, it's DNS.

2. **Check domain status in Lovable**
   - Open Project Settings → Domains and read the status for `barcodetruth.com` and `www.barcodetruth.com`.
   - Expected healthy state: `Active` for both, with one marked Primary.
   - Likely failure states and what they mean:
     - `Offline` → DNS drifted; A records no longer point to `185.158.133.1`.
     - `Verifying` / `Setting up` → SSL or verification regressed; needs to finish or be retried.
     - `Failed` → cert issuance failed; needs Retry.
     - `Removed` → domain got detached (often because it was added to another project).
     - Only `barcodetruth.com` listed and not `www` (or vice versa) → the missing host has no binding and will 404.

3. **Check DNS from outside**
   - Resolve A records for `barcodetruth.com` and `www.barcodetruth.com`. They must point to `185.158.133.1`.
   - Confirm the `_lovable` TXT record still exists.
   - If Cloudflare/another proxy is in front, confirm whether proxy mode was expected (CNAME-based) vs A-record direct.
   - Look for stray/extra A, AAAA, ALIAS, or CNAME records on the same host that would override Lovable's.

4. **Check publish state**
   - Confirm the project is still Published (not unpublished). An unpublished project will 404 on the custom domain even if DNS is correct.
   - Confirm publish visibility is `public`. If it flipped to `private`, non-members get blocked (usually an auth screen, but worth ruling out).

5. **Decide the fix from what we find**
   - DNS drift → re-add the A records (`@` and `www` → `185.158.133.1`) and the `_lovable` TXT at the registrar; wait for propagation.
   - Domain showing `Failed` / `Offline` in Lovable → hit Retry / reconnect in Project Settings → Domains.
   - Domain `Removed` → reconnect it (re-verify ownership).
   - Project unpublished → republish.
   - Only one host bound → add the missing one (`www` or apex) and set Primary.

## What I need from you
- Want me to run the external checks (HTTP probes against `barcodetruth.com`, `www.barcodetruth.com`, and `barcodetruth.lovable.app`, plus a DNS lookup) so we know which bucket this falls into before touching anything? That's read-only and safe.
- And can you peek at **Project Settings → Domains** and tell me the status shown next to `barcodetruth.com` and `www.barcodetruth.com`? That single piece of info usually resolves which of the five fixes above applies.

I won't change DNS, republish, or reconnect the domain until we've confirmed which failure mode this is — guessing here can make it worse (e.g. republishing while a cert is mid-issue, or re-adding the domain and resetting verification).

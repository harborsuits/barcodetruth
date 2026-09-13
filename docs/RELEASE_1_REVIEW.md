# Release 1: entry, scan recovery and ownership research

Status: local review candidate. This is not a completed paid launch.

## Changes

- Public homepage offers product/brand search and a focused packaged-food coverage statement. Unsupported static sample verdicts are no longer rendered.
- Auth and onboarding carry a sanitized internal return destination, including query strings and fragments. Optional installation screens no longer precede the sign-in form by default.
- Successful scanner lookups open the product result. Confirmed misses open the contribution path; failed requests offer retry rather than asserting a missing product or promising research. Result lookups no longer retry research-triggering fallbacks automatically.
- Ownership records show recorded relationships, sources and review dates instead of treating an unordered list as an ultimate-parent chain. Unsupported names and missing information are labeled.
- Two sourced ownership pages and an interactive English Breakfast tea comparison are available at `/ownership/bigelow`, `/ownership/twinings`, and `/compare/english-breakfast-tea`. The comparison supports the explicit preference for a different ownership group; it does not evaluate other values or assert barcode/package identification.
- SQL repairs the UUID/TEXT alternatives failure, enforces bounded candidate limits and known subcategories, excludes test brands, and preserves missing scores. These results are research candidates, not verified personalized recommendations.
- Catalog SQL admits active/ready published brand records and excludes pending/rejected product submissions.

## Review locally

From the app directory in PowerShell:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run dev:review -- --port 8080 --strictPort
```

The checked-in `.env.review` enables a network guard for the configured remote backend. Only public table GET/HEAD requests and three reviewed GET RPCs are allowed. Remote writes, authentication and edge-function calls are blocked. Google sign-in and account submission are disabled. The scanner's failed-lookup state can therefore be exercised without creating production records.

This is a read-only preview, not an isolated copy of production. For full account testing, supply an isolated backend and explicitly disable the preview flag for that environment. Never turn off the guard while testing against production.

For a static review build use `npm.cmd run build:review`. A normal `npm.cmd run build` does not enable the review guard; do not deploy a review build as production.

## Verification

```powershell
npm.cmd run test:release
npx.cmd tsc --noEmit --project tsconfig.app.json --pretty false
& .\scripts\test-release-db.ps1
npm.cmd run build:review
```

The SQL script creates an ephemeral PostgreSQL 16 container with no network and no published ports. It reproduces the old 42883 error, applies the new functions, and checks publication/unknown-data/limit behavior under a non-owner role. It is not a production RLS audit or a migration of all historical database files.

Browser checks performed: public homepage/search, mobile-width layout, signed-out onboarding return URL with query/fragment, disabled preview sign-in controls, recoverable lookup error, and changing the tea comparison preference.

## Deployment dependencies

1. Finish real-session password/OAuth/email confirmation and onboarding tests against an isolated backend. Confirm the allowed `/auth?returnTo=...` callback URLs. Verify phone camera/manual-input behavior on an actual device.
2. Review account privacy, saved lists, billing/portal/webhook recovery and alert delivery before a paid release. Existing Stripe integration is in test mode; the working new annual offer remains $29/year, not a verified purchasable offer.
3. Deploy this frontend before the candidate-only alternatives function. Older frontend code ignores `candidate` rows while retaining unsupported ranking claims.
4. Apply the two new SQL migrations only to the actual active Lovable backend, after preserving existing function definitions. Do not apply them to the separate historical Supabase project with the same name. Record migration history through the deployment mechanism.
5. Smoke-test the paired release and confirm rollback. Existing function definitions were exported locally before changes; no production function or data has been changed by this work cycle.

The release remains in review until these dependencies are resolved. Broad ownership coverage, personalized alternatives, full account isolation, paid checkout and real-device acceptance are not established by these checks.

## Shopping-reason preview, September 13

See [SHOPPING_REASONS_REVIEW.md](SHOPPING_REASONS_REVIEW.md) for the subsequent shopper flow, source packet, tests and remaining limits. The scan result now uses explicit reasons and approved product records instead of the legacy aggregate verdict.

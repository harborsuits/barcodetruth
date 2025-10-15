# TICKET G: Admin Evidence Submitter

## Overview
Admin interface to manually add brand events with source URLs. Single-transaction upsert with automatic coverage refresh.

## Database Changes

### New Functions

1. **`canonicalize_source_url(p_url text)`**
   - Parses and normalizes URLs
   - Returns: domain_owner, source_name, canonical_url
   - Strips trailing slashes, lowercases, removes `www.` prefix

2. **`admin_add_evidence(...)`**
   - Single RPC for atomic event+source creation
   - Parameters:
     - `p_brand_id` (uuid)
     - `p_title` (text)
     - `p_source_url` (text)
     - `p_verification` (text: 'official' | 'corroborated' | 'unverified')
     - `p_category` (text: 'labor' | 'environment' | 'politics' | 'social')
     - `p_event_date` (date)
     - `p_notes` (text, optional)
   - **Idempotent**: ON CONFLICT updates existing events by (brand_id, occurred_at, title)
   - Returns: (event_id uuid, source_id uuid)
   - Auto-calls `refresh_brand_coverage()` on success

## Frontend Implementation

### New Route: `/admin/evidence/new`

**Components:**
- Brand search with autocomplete (ILIKE on brands.name)
- Form fields:
  - Title (required)
  - Source URL (required, validated)
  - Verification level (select)
  - Category (select)
  - Event date (date picker)
  - Notes (optional textarea)

**Flow:**
1. Admin searches/selects brand
2. Fills form with event details
3. On submit: calls `supabase.rpc('admin_add_evidence', {...})`
4. Success → toast + navigate to `/brand/:id`
5. Failure → error toast with message

**Security:**
- Route wrapped in `<AdminRoute>` (requires admin role)
- RPC SECURITY DEFINER with admin-only grant

## Acceptance Criteria

### 1. Add New Evidence
- Navigate to `/admin/evidence/new`
- Search "Coca-Cola" → select brand
- Fill:
  - Title: "EPA water pollution violation"
  - Source URL: `https://www.epa.gov/enforcement/coca-cola-settlement`
  - Verification: Official
  - Category: Environment
  - Event date: 2025-01-15
- Submit → success toast + redirects to `/brand/{coca-cola-id}`

### 2. Coverage Refresh
- Go to brand profile
- Verify evidence appears in timeline
- Coverage chips update:
  - `events_30d`, `events_90d`, `events_365d` incremented
  - `last_event_at` updated
  - `verified_rate` recalculated if verification changed
  - `independent_sources` updated with new domain

### 3. Idempotency
- Submit same event again (same title + date + brand)
- No duplicate event created
- Existing event updated (verification/category/notes)
- Toast: "Evidence added" (not "duplicate")

### 4. Validation
- Empty title → error toast
- Invalid URL (no protocol, malformed) → error toast
- No brand selected → error toast
- Form disabled while submitting (loading state)

## Integration Notes

- RPC uses existing enums: `verification_level`, `event_category`
- ON CONFLICT clause uses composite key: `(brand_id, occurred_at, title)`
- Assumes brand_events has unique constraint on above columns
- If constraint missing, add:
  ```sql
  ALTER TABLE brand_events ADD CONSTRAINT unique_event_per_brand_date_title 
    UNIQUE (brand_id, occurred_at, title);
  ```

## Pre-existing Warnings
Migration linter flagged:
- Security definer views (pre-existing, not from this ticket)
- Materialized view in API (brand_data_coverage, pre-existing)

**No new security issues introduced.**

## Merge Checklist
- [x] `canonicalize_source_url` function created
- [x] `admin_add_evidence` RPC created with SECURITY DEFINER
- [x] AdminEvidence.tsx page created
- [x] Route added to App.tsx with AdminRoute guard
- [ ] Test: Add new evidence → appears in brand profile
- [ ] Test: Coverage chips update (30d/90d/365d, verified_rate, independent_sources)
- [ ] Test: Duplicate submit updates in place (idempotent)
- [ ] Test: URL validation catches malformed URLs
- [ ] Test: Non-admin users redirected to /forbidden

---

**✅ Ready to test. G complete with idempotent upsert and coverage refresh.**

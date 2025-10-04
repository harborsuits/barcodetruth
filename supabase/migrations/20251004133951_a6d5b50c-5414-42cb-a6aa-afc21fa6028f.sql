-- Lock down base moderator views that should only be accessed via the wrapped view
-- These contain internal moderation data and should not be directly queryable

-- Remove public access to the base view
revoke all on table product_claims_moderator_base from public, anon, authenticated;

-- Remove public access to the evidence view
revoke all on table brand_evidence_view from public, anon, authenticated;

-- Only the service role (used by wrapped views and edge functions) can access these
-- Normal users should only query through the secured product_claims_moderator view
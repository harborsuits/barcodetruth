-- Fix Security Definer View warning by switching to security_invoker
-- This maintains the same security (role-based filtering) but uses the recommended approach

drop view if exists product_claims_moderator;

-- Recreate with security_invoker instead of security_barrier
create or replace view product_claims_moderator
with (security_invoker = on) as
select *
from product_claims_moderator_base
where is_mod_or_admin(auth.uid());

-- Maintain the same grants
revoke all on table product_claims_moderator from public, anon, authenticated;
grant select on table product_claims_moderator to authenticated;
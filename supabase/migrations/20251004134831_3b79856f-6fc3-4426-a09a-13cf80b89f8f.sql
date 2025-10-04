-- =====================================================================
-- Security Hardening: Moderator Views, Notification Log, Push Subs
-- =====================================================================

-- 1) LOCK DOWN MODERATOR VIEWS
-- =====================================================================

-- Rename brand_evidence_view to brand_evidence_view_base if not already done
do $$ begin
  if exists (select 1 from pg_views where schemaname='public' and viewname='brand_evidence_view_base') then
    null;
  elsif exists (select 1 from pg_views where schemaname='public' and viewname='brand_evidence_view') then
    execute 'alter view public.brand_evidence_view rename to brand_evidence_view_base';
  end if;
end $$;

-- Create guarded wrapper for product_claims_moderator
create or replace view public.product_claims_moderator
with (security_invoker = on) as
select * from public.product_claims_moderator_base
where is_mod_or_admin(auth.uid());

-- Create guarded wrapper for brand_evidence_view
create or replace view public.brand_evidence_view
with (security_invoker = on) as
select * from public.brand_evidence_view_base
where is_mod_or_admin(auth.uid());

-- Grant SELECT on guarded wrappers to authenticated users
-- (Non-mods will get 0 rows due to the WHERE clause)
revoke all on table public.product_claims_moderator from public, anon;
revoke all on table public.brand_evidence_view from public, anon;
grant select on table public.product_claims_moderator to authenticated;
grant select on table public.brand_evidence_view to authenticated;

-- 2) HARDEN NOTIFICATION_LOG PRIVACY
-- =====================================================================

-- Ensure RLS is enabled
alter table public.notification_log enable row level security;

-- Drop existing policies
drop policy if exists notification_log_select on public.notification_log;
drop policy if exists notification_log_insert on public.notification_log;
drop policy if exists notification_log_update on public.notification_log;
drop policy if exists notification_log_delete on public.notification_log;

-- Create strict RLS policies
create policy notification_log_select
on public.notification_log for select
to authenticated
using (user_id = auth.uid());

create policy notification_log_insert
on public.notification_log for insert
to authenticated
with check (user_id = auth.uid());

create policy notification_log_update
on public.notification_log for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notification_log_delete
on public.notification_log for delete
to authenticated
using (user_id = auth.uid());

-- Ensure proper grants
revoke all on table public.notification_log from anon;
grant select, insert, update, delete on table public.notification_log to authenticated;

-- Add index for performance
create index if not exists notification_log_user_idx on public.notification_log(user_id);

-- 3) PROTECT USER_PUSH_SUBS WITH RLS + ENCRYPTION COLUMNS
-- =====================================================================

-- Ensure RLS is enabled
alter table public.user_push_subs enable row level security;

-- Add encrypted columns for sensitive data
alter table public.user_push_subs
  add column if not exists auth_enc bytea,
  add column if not exists p256dh_enc bytea;

-- Drop existing policies
drop policy if exists user_push_subs_select on public.user_push_subs;
drop policy if exists user_push_subs_ins on public.user_push_subs;
drop policy if exists user_push_subs_upd on public.user_push_subs;
drop policy if exists user_push_subs_del on public.user_push_subs;
drop policy if exists user_push_subs_insert on public.user_push_subs;
drop policy if exists user_push_subs_update on public.user_push_subs;
drop policy if exists user_push_subs_delete on public.user_push_subs;

-- Create strict RLS policies
create policy user_push_subs_select
on public.user_push_subs for select
to authenticated
using (user_id = auth.uid());

create policy user_push_subs_insert
on public.user_push_subs for insert
to authenticated
with check (user_id = auth.uid());

create policy user_push_subs_update
on public.user_push_subs for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy user_push_subs_delete
on public.user_push_subs for delete
to authenticated
using (user_id = auth.uid());

-- Ensure proper grants
revoke all on table public.user_push_subs from anon;
grant select, insert, update, delete on table public.user_push_subs to authenticated;

-- Add indexes for performance and uniqueness
create index if not exists user_push_subs_user_idx on public.user_push_subs(user_id);
create unique index if not exists user_push_subs_user_endpoint_uniq on public.user_push_subs(user_id, endpoint);
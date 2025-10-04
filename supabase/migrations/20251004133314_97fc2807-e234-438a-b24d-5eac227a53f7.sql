-- Create is_mod_or_admin helper using existing has_role function
create or replace function is_mod_or_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_role(uid,'admin'::app_role) or has_role(uid,'moderator'::app_role);
$$;

-- Secure product_claims_moderator view with role-based filtering
do $$ begin
  if exists (select 1 from pg_views where viewname = 'product_claims_moderator_base') then
    null; -- already wrapped
  elsif exists (select 1 from pg_views where viewname = 'product_claims_moderator') then
    execute 'alter view product_claims_moderator rename to product_claims_moderator_base';
  end if;
end $$;

-- Guarded view that only returns rows for moderators/admins
create or replace view product_claims_moderator
with (security_barrier = true) as
select *
from product_claims_moderator_base
where is_mod_or_admin(auth.uid());

-- Lock down grants
revoke all on table product_claims_moderator from public, anon, authenticated;
grant select on table product_claims_moderator to authenticated;

-- Harden notification_log RLS policies
alter table notification_log enable row level security;

drop policy if exists notification_log_select on notification_log;
drop policy if exists notification_log_insert on notification_log;
drop policy if exists notification_log_update on notification_log;
drop policy if exists notification_log_delete on notification_log;

-- Least-privilege policies for authenticated users
create policy notification_log_select
on notification_log for select
to authenticated
using (user_id = auth.uid());

create policy notification_log_insert
on notification_log for insert
to authenticated
with check (user_id = auth.uid());

create policy notification_log_update
on notification_log for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notification_log_delete
on notification_log for delete
to authenticated
using (user_id = auth.uid());

-- Prevent anonymous access
revoke all on table notification_log from anon;
grant select, insert, update, delete on table notification_log to authenticated;
-- 1) Prevent duplicate active claims (already added, but ensuring idempotency)
create unique index if not exists uniq_active_claim
on public.product_claims (barcode_ean13, claimed_brand_id)
where status in ('pending','verified');

-- 2) Ensure products barcode uniqueness
create unique index if not exists uniq_products_barcode 
on public.products (barcode);

-- 3) Moderation config table for tunable rules
create table if not exists public.moderation_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed default auto-accept rule
insert into public.moderation_config(key, value)
values ('auto_accept_rule', '{"min_score":3,"min_upvotes":2}')
on conflict (key) do update set value=excluded.value;

-- RLS for config (admins can read/write, others read-only)
alter table public.moderation_config enable row level security;

create policy "Anyone can read moderation config"
on public.moderation_config
for select using (true);

create policy "Admins can update moderation config"
on public.moderation_config
for all using (
  exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  )
);
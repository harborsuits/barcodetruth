-- ensure extension once
create extension if not exists unaccent;

-- normalizer (if not already created)
create or replace function normalize_brand_label(txt text)
returns text language sql immutable as $$
  select trim(
           regexp_replace(
             regexp_replace(
               lower(unaccent(coalesce($1,''))),
               '^\s*xx:\s*',''
             ),
             '[-_&]+',' ','g'
           )
         )
$$;

-- brands norm column + unique index (idempotent)
alter table brands
  add column if not exists norm_name text
    generated always as (normalize_brand_label(name)) stored;

-- Create unique index only if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_indexes 
    where schemaname = 'public' 
    and tablename = 'brands' 
    and indexname = 'brands_norm_name_uidx'
  ) then
    create unique index brands_norm_name_uidx on brands(norm_name);
  end if;
end $$;

-- 🚀 RPC with new return fields, using existing brand_aliases schema
create or replace function merge_staged_products_batch(
  batch_size integer default 200,
  dry_run boolean default false
)
returns table (
  merged integer,
  skipped_unmapped integer,
  remaining integer,
  created_brands integer,
  sample_unmapped text[]
)
language plpgsql
security definer
as $$
declare
  v_created int := 0;
begin
  -- create any missing brands from current staging batch universe
  with cand as (
    select distinct normalize_brand_label(s.brand_label) as norm
    from product_staging s
    where coalesce(s.brand_label,'') <> ''
  ), missing as (
    select c.norm
    from cand c
    left join brands b on b.norm_name = c.norm
    left join brand_aliases a on normalize_brand_label(a.external_name) = c.norm
    where b.id is null and a.id is null and c.norm <> ''
  ), ins as (
    insert into brands(name)
    select initcap(m.norm) from missing m
    on conflict do nothing
    returning 1
  )
  select coalesce(sum(1),0) into v_created from ins;

  return query
  with normed as (
    select s.id, s.barcode, s.product_name,
           normalize_brand_label(s.brand_label) as norm_brand
    from product_staging s
    order by s.id
    limit batch_size
  ),
  resolved as (
    select n.id, n.barcode, n.product_name, n.norm_brand,
           coalesce(a.canonical_brand_id, b.id) as resolved_brand_id
    from normed n
    left join brand_aliases a on normalize_brand_label(a.external_name) = n.norm_brand
    left join brands b on b.norm_name = n.norm_brand
  ),
  to_merge as (
    select * from resolved where resolved_brand_id is not null
  ),
  unmapped as (
    select * from resolved where resolved_brand_id is null
  ),
  upserted as (
    insert into products (barcode, name, brand_id)
    select t.barcode, t.product_name, t.resolved_brand_id
    from to_merge t
    where not dry_run
    on conflict (barcode) do update
      set name = excluded.name,
          brand_id = excluded.brand_id
    returning 1
  ),
  deleted_staging as (
    delete from product_staging
    where id in (select id from to_merge)
      and not dry_run
    returning 1
  )
  select
    (select count(*)::int from to_merge) as merged,
    (select count(*)::int from unmapped) as skipped_unmapped,
    greatest((select count(*)::int from product_staging) - batch_size, 0) as remaining,
    v_created as created_brands,
    (select array_agg(distinct u.norm_brand)
       from (select norm_brand from unmapped limit 10) u) as sample_unmapped;
end;
$$;

grant execute on function merge_staged_products_batch(integer, boolean)
  to anon, authenticated, service_role;
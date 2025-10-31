-- Enable pgcrypto for content hashing
create extension if not exists pgcrypto;

-- Add unique constraint on staging_products.content_hash for deduplication
do $$
begin
  if not exists (
    select 1 from pg_indexes 
    where tablename='staging_products' and indexname='staging_products_content_hash_key'
  ) then
    alter table staging_products
      add constraint staging_products_content_hash_key unique(content_hash);
  end if;
end$$;

-- Deduplicate brand_aliases.external_name (keep most recent created_at)
delete from brand_aliases a
using (
  select external_name, min(created_at) as first_created
  from brand_aliases
  group by external_name
  having count(*) > 1
) dupes
where a.external_name = dupes.external_name
  and a.created_at > dupes.first_created;

-- Add unique constraint on brand_aliases.external_name to prevent duplicate mappings
do $$
begin
  if not exists (
    select 1 from pg_indexes 
    where tablename='brand_aliases' and indexname='brand_aliases_external_name_key'
  ) then
    alter table brand_aliases
      add constraint brand_aliases_external_name_key unique(external_name);
  end if;
end$$;

-- Update merge function to correctly use brand_aliases.external_name → canonical_brand_id
create or replace function public.merge_staged_products_batch()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged int := 0;
  v_remaining int := 0;
  v_batch_size int := 200;
begin
  -- Merge staged products into products table
  with batch as (
    select id, barcode, product_name, brand_label, category
    from staging_products
    order by created_at
    limit v_batch_size
  ),
  mapped as (
    select 
      b.barcode,
      b.product_name,
      b.category,
      a.canonical_brand_id as brand_id
    from batch b
    left join brand_aliases a on a.external_name = b.brand_label
  ),
  inserted as (
    insert into products (barcode, name, brand_id, category)
    select barcode, product_name, brand_id, category
    from mapped
    on conflict (barcode) do update
    set 
      name = excluded.name,
      brand_id = excluded.brand_id,
      category = excluded.category,
      updated_at = now()
    returning barcode
  ),
  deleted as (
    delete from staging_products
    where id in (select id from batch)
    returning id
  )
  select count(*) into v_merged from deleted;

  -- Count remaining staged products
  select count(*) into v_remaining from staging_products;

  return jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining
  );
end;
$$;
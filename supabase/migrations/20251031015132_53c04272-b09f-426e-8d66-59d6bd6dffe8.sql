-- Fix merge_staged_products_batch to handle null/empty product names
CREATE OR REPLACE FUNCTION public.merge_staged_products_batch()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_merged int := 0;
  v_remaining int := 0;
begin
  -- Process up to 200 staging rows
  with next_batch as (
    select *
    from staging_products
    where product_name is not null and trim(product_name) != ''
    order by inserted_at
    limit 200
  ),
  inserted as (
    insert into public.products (barcode, name, brand_id, category)
    select
      normalize_barcode(nb.barcode) as barcode,
      nb.product_name,
      coalesce(
        (select canonical_brand_id from brand_aliases where external_name ilike nb.brand_label limit 1),
        (select id from brands where name ilike nb.brand_label limit 1)
      ) as brand_id,
      nullif(nb.category, '')
    from next_batch nb
    where nb.barcode ~ '^\d{8,14}$'
    on conflict (barcode) do update
    set
      name = coalesce(excluded.name, products.name),
      brand_id = coalesce(excluded.brand_id, products.brand_id),
      category = coalesce(excluded.category, products.category)
    returning 1
  ),
  enqueued as (
    insert into brand_enrichment_queue (brand_id, task)
    select distinct p.brand_id, 'full'::text
    from products p
    join next_batch nb on normalize_barcode(nb.barcode) = p.barcode
    where p.brand_id is not null
    on conflict do nothing
    returning 1
  ),
  deleted as (
    delete from staging_products
    where id in (select id from next_batch)
    returning 1
  )
  select count(*) into v_merged from inserted;
  
  select count(*) into v_remaining from staging_products;
  
  return jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining
  );
end;
$function$;
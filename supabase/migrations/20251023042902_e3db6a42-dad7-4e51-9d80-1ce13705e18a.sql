-- Fix RPCs to resolve company robustly and match current schema columns
-- 1) Key People
create or replace function public.rpc_get_key_people(p_brand_id uuid)
returns table (
  person_qid text,
  person_name text,
  role text,
  title text,
  seniority text,
  start_date date,
  end_date date,
  source text,
  last_updated timestamptz,
  image_url text
)
security definer
language plpgsql
as $$
begin
  return query
  with company_choice as (
    -- Preferred: direct parent link
    select co.parent_company_id as company_id, 1 as pref
    from public.company_ownership co
    where co.child_brand_id = p_brand_id
    union all
    -- Fallback 1: brand->wikidata mapping
    select c.id, 2
    from public.brand_data_mappings bdm
    join public.companies c on c.wikidata_qid = bdm.external_id
    where bdm.brand_id = p_brand_id
      and bdm.source = 'wikidata'
    union all
    -- Fallback 2: same Wikidata QID
    select c2.id, 3
    from public.brands b
    join public.companies c2 on c2.wikidata_qid = b.wikidata_qid
    where b.id = p_brand_id
  ),
  chosen as (
    select company_id
    from company_choice
    where company_id is not null
    order by pref asc
    limit 1
  )
  select
    cp.person_qid,
    cp.person_name,
    coalesce(cp.role, 'unknown') as role,
    null::text as title,
    null::text as seniority,
    null::date as start_date,
    null::date as end_date,
    coalesce(cp.source_name, cp.source) as source,
    coalesce(cp.last_verified_at, cp.created_at) as last_updated,
    cp.image_url
  from chosen ch
  join public.company_people cp on cp.company_id = ch.company_id
  order by
    case lower(coalesce(cp.role, ''))
      when 'chief_executive_officer' then 1
      when 'ceo' then 1
      when 'chairperson' then 2
      when 'founder' then 3
      else 4
    end,
    cp.person_name;
end;
$$;

grant execute on function public.rpc_get_key_people(uuid) to anon, authenticated;

-- 2) Top Shareholders with fallback to ownership details
create or replace function public.rpc_get_top_shareholders(p_brand_id uuid, p_limit int default 10)
returns table (
  holder_name text,
  holder_type text,
  percent_owned numeric,
  shares_owned bigint,
  as_of date,
  source text,
  last_updated timestamptz,
  is_asset_manager boolean,
  holder_wikidata_qid text,
  wikipedia_url text,
  holder_url text,
  data_source text
)
security definer
language plpgsql
as $$
begin
  return query
  with company_choice as (
    -- Preferred: direct parent link
    select co.parent_company_id as company_id, 1 as pref
    from public.company_ownership co
    where co.child_brand_id = p_brand_id
    union all
    -- Fallback 1: brand->wikidata mapping
    select c.id, 2
    from public.brand_data_mappings bdm
    join public.companies c on c.wikidata_qid = bdm.external_id
    where bdm.brand_id = p_brand_id
      and bdm.source = 'wikidata'
    union all
    -- Fallback 2: same Wikidata QID
    select c2.id, 3
    from public.brands b
    join public.companies c2 on c2.wikidata_qid = b.wikidata_qid
    where b.id = p_brand_id
  ),
  chosen as (
    select company_id
    from company_choice
    where company_id is not null
    order by pref asc
    limit 1
  ),
  from_enriched as (
    select
      cs.holder_name,
      cs.holder_type,
      cs.pct as percent_owned,
      null::bigint as shares_owned,
      cs.as_of as as_of,
      coalesce(cs.source_name, cs.source) as source,
      cs.created_at as last_updated,
      coalesce(cs.is_asset_manager, false) as is_asset_manager,
      cs.holder_wikidata_qid,
      cs.wikipedia_url,
      cs.holder_url,
      'company_shareholders'::text as data_source
    from chosen ch
    join public.company_shareholders cs on cs.company_id = ch.company_id
  ),
  from_fallback as (
    select
      cod.owner_name as holder_name,
      cod.owner_type as holder_type,
      cod.percent_owned,
      null::bigint as shares_owned,
      cod.as_of as as_of,
      cod.source as source,
      cod.updated_at as last_updated,
      false as is_asset_manager,
      null::text as holder_wikidata_qid,
      null::text as wikipedia_url,
      null::text as holder_url,
      'company_ownership_details'::text as data_source
    from chosen ch
    join public.company_ownership_details cod on cod.company_id = ch.company_id
  ),
  unioned as (
    select * from from_enriched
    union all
    select * from from_fallback
  )
  select *
  from unioned
  order by percent_owned desc nulls last, holder_name asc
  limit p_limit;
end;
$$;

grant execute on function public.rpc_get_top_shareholders(uuid, int) to anon, authenticated;

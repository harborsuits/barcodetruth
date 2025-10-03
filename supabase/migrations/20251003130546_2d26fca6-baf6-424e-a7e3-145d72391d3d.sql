-- 1) Inline Sources View
create or replace view public.v_brand_sources_inline as
select
  be.brand_id,
  be.category,
  be.event_id,
  be.occurred_at,
  coalesce(be.title, be.raw_data->>'title', initcap(be.category::text)||' event') as title,
  es.source_name as source,
  es.source_url as url,
  be.severity,
  (be.raw_data->>'amount')::numeric as amount,
  be.verification
from brand_events be
left join event_sources es on es.event_id = be.event_id
where be.occurred_at is not null
order by be.occurred_at desc;

-- Index for performance
create index if not exists idx_brand_events_category_date 
  on brand_events(brand_id, category, occurred_at desc);

-- 2) Parent Rollups View
create or replace view public.v_parent_rollups as
with leaf_scores as (
  select 
    b.id as brand_id,
    coalesce(b.parent_company, b.name) as root_id,
    b.name as brand_name,
    bs.score_labor, 
    bs.score_environment, 
    bs.score_politics, 
    bs.score_social,
    coalesce((bs.breakdown->'labor'->>'confidence')::int, 50) as conf_labor,
    coalesce((bs.breakdown->'environment'->>'confidence')::int, 50) as conf_env,
    coalesce((bs.breakdown->'politics'->>'confidence')::int, 50) as conf_pol,
    coalesce((bs.breakdown->'social'->>'confidence')::int, 50) as conf_soc
  from brands b
  join brand_scores bs on bs.brand_id = b.id
)
select
  root_id as parent_id,
  round(avg(score_labor))::int as parent_labor,
  round(avg(score_environment))::int as parent_environment,
  round(avg(score_politics))::int as parent_politics,
  round(avg(score_social))::int as parent_social,
  round(avg(conf_labor))::int as parent_conf_labor,
  round(avg(conf_env))::int as parent_conf_env,
  round(avg(conf_pol))::int as parent_conf_pol,
  round(avg(conf_soc))::int as parent_conf_soc,
  count(*)::int as child_count,
  array_agg(brand_name) as child_brands
from leaf_scores
group by root_id;
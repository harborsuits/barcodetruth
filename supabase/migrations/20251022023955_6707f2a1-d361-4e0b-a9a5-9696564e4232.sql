-- Add refresh function for community outlook materialized view
create or replace function refresh_community_outlook()
returns void
language sql
security definer
as $$
  refresh materialized view concurrently brand_category_outlook;
$$;

grant execute on function refresh_community_outlook() to anon, authenticated;

-- Add index for IP-based flood detection (for future use)
create index if not exists idx_commratings_ip on community_ratings(ip_hash);
create index if not exists idx_commratings_brand_cat on community_ratings(brand_id, category);
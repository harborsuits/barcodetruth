-- Drop and recreate the ownership header RPC with proper logic
drop function if exists public.rpc_get_brand_ownership_header(uuid);

create or replace function public.rpc_get_brand_ownership_header(p_brand_id uuid)
returns table (
  is_ultimate_parent boolean,
  owner_company_name text,
  ultimate_parent_name text
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_brand_company_id uuid;
  v_direct_parent_id uuid;
  v_direct_parent_name text;
  v_ultimate_parent_id uuid;
  v_ultimate_parent_name text;
  v_is_ultimate boolean := false;
begin
  -- Get the company ID for this brand
  select resolve_company_for_brand(p_brand_id) into v_brand_company_id;
  
  -- Get the direct parent from company_ownership
  select co.parent_company_id, c.name
  into v_direct_parent_id, v_direct_parent_name
  from public.company_ownership co
  left join public.companies c on c.id = co.parent_company_id
  where co.child_brand_id = p_brand_id
    and co.relationship_type = 'control' or co.relationship in ('parent', 'subsidiary', 'parent_organization')
  order by co.confidence desc nulls last, co.created_at desc
  limit 1;
  
  -- Check if this brand is an ultimate parent
  -- (no parent record, or parent points to itself)
  if v_direct_parent_id is null or v_direct_parent_id = v_brand_company_id then
    v_is_ultimate := true;
    v_direct_parent_name := null;
    v_ultimate_parent_name := null;
  else
    -- Walk up the chain to find ultimate parent
    v_ultimate_parent_id := v_direct_parent_id;
    v_ultimate_parent_name := v_direct_parent_name;
    
    -- Simple traversal (max 10 hops to prevent infinite loops)
    for i in 1..10 loop
      declare
        v_next_parent_id uuid;
        v_next_parent_name text;
      begin
        select co.parent_company_id, c.name
        into v_next_parent_id, v_next_parent_name
        from public.company_ownership co
        left join public.companies c on c.id = co.parent_company_id
        where co.child_company_id = v_ultimate_parent_id
          and (co.relationship_type = 'control' or co.relationship in ('parent', 'subsidiary', 'parent_organization'))
        order by co.confidence desc nulls last
        limit 1;
        
        -- If no parent found or self-reference, we've reached the top
        if v_next_parent_id is null or v_next_parent_id = v_ultimate_parent_id then
          exit;
        end if;
        
        v_ultimate_parent_id := v_next_parent_id;
        v_ultimate_parent_name := v_next_parent_name;
      end;
    end loop;
  end if;
  
  return query select 
    v_is_ultimate,
    v_direct_parent_name,
    case 
      when v_is_ultimate then null
      when v_ultimate_parent_name = v_direct_parent_name then null
      else v_ultimate_parent_name
    end;
end;
$$;

grant execute on function public.rpc_get_brand_ownership_header(uuid) to anon, authenticated;

comment on function public.rpc_get_brand_ownership_header is 
  'Returns ownership header info: whether brand is ultimate parent, direct owner name, and ultimate parent name';

-- Add indexes to speed up ownership queries
create index if not exists idx_co_parent_company on public.company_ownership(parent_company_id);
create index if not exists idx_co_child_brand on public.company_ownership(child_brand_id);
create index if not exists idx_co_child_company on public.company_ownership(child_company_id);
create index if not exists idx_companies_wikidata on public.companies(wikidata_qid);

-- Add FK constraint to prevent orphaned parent references (if not exists)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'fk_co_parent_company' 
    and table_name = 'company_ownership'
  ) then
    alter table public.company_ownership
      add constraint fk_co_parent_company
      foreign key (parent_company_id) references public.companies(id)
      on delete set null;
  end if;
end $$;
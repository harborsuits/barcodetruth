-- 1) Prereqs (extensions)
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- 2) Types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('pending', 'verified', 'rejected');
  end if;
end$$;

-- 3) Tables (gs1, claims, votes)
create table if not exists public.gs1_prefix_registry (
  prefix       text primary key,
  company_name text not null,
  country      text,
  source       text default 'seed',
  created_at   timestamptz not null default now()
);

create table if not exists public.product_claims (
  id               uuid primary key default gen_random_uuid(),
  barcode_ean13    text not null,
  claimed_brand_id uuid not null references public.brands(id) on delete cascade,
  product_name     text,
  source_hint      text,
  confidence       int  not null default 70 check (confidence between 0 and 100),
  status           submission_status not null default 'pending',
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  moderated_by     uuid references auth.users(id),
  moderated_at     timestamptz,
  rejection_reason text
);

create table if not exists public.product_claim_votes (
  claim_id   uuid not null references public.product_claims(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (claim_id, user_id)
);

-- 4) Indexes
create index if not exists idx_product_claims_barcode
  on public.product_claims (barcode_ean13);
create index if not exists idx_product_claims_status
  on public.product_claims (status);
create index if not exists idx_product_claims_created_at
  on public.product_claims (created_at desc);
create index if not exists idx_product_claims_brand_status
  on public.product_claims (claimed_brand_id, status, created_at desc);
create index if not exists idx_claim_votes_claim
  on public.product_claim_votes (claim_id);

-- 5) RLS
alter table public.gs1_prefix_registry    enable row level security;
alter table public.product_claims         enable row level security;
alter table public.product_claim_votes    enable row level security;

-- GS1: public read
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='gs1_prefix_registry' and policyname='Public read GS1'
  ) then
    create policy "Public read GS1"
      on public.gs1_prefix_registry
      for select using (true);
  end if;
end $$;

-- Claims: read non-rejected; creator sees their own
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='product_claims' and policyname='Read claims'
  ) then
    create policy "Read claims"
      on public.product_claims
      for select
      using (
        status in ('pending','verified')
        or created_by = auth.uid()
      );
  end if;
end $$;

-- Claims: authenticated can insert
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='product_claims' and policyname='Insert claims'
  ) then
    create policy "Insert claims"
      on public.product_claims
      for insert
      with check (auth.uid() is not null and created_by = auth.uid());
  end if;
end $$;

-- Claims: allow DELETE by creator within 60s (for Undo)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='product_claims' and policyname='Undo delete (60s)'
  ) then
    create policy "Undo delete (60s)"
      on public.product_claims
      for delete
      using (created_by = auth.uid() and created_at > (now() - interval '60 seconds'));
  end if;
end $$;

-- Votes: anyone can read; authenticated can insert their vote
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='product_claim_votes' and policyname='Read votes'
  ) then
    create policy "Read votes"
      on public.product_claim_votes
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='product_claim_votes' and policyname='Insert votes'
  ) then
    create policy "Insert votes"
      on public.product_claim_votes
      for insert
      with check (auth.uid() is not null and user_id = auth.uid());
  end if;
end $$;

-- 6) Seed GS1 prefixes
insert into public.gs1_prefix_registry (prefix, company_name, country, source) values
 ('0072250','Flowers Foods','US','seed'),
 ('0001820','General Mills','US','seed'),
 ('0001600','Nestlé USA','US','seed'),
 ('0002840','Kellogg Company','US','seed'),
 ('0004150','Kraft Heinz','US','seed'),
 ('0003700','PepsiCo','US','seed'),
 ('0004900','Coca-Cola','US','seed'),
 ('0007622','Bimbo Bakeries USA','US','seed'),
 ('0001111','Smithfield Foods','US','seed'),
 ('0002100','Dole Food Company','US','seed'),
 ('0003800','ConAgra Foods','US','seed'),
 ('0004400','Campbell Soup Company','US','seed'),
 ('0005100','The Hershey Company','US','seed'),
 ('0005200','Mars, Inc.','US','seed'),
 ('0006100','Unilever','US','seed'),
 ('0007400','Mondelēz International','US','seed'),
 ('0008200','Hormel Foods','US','seed'),
 ('0009600','TreeHouse Foods','US','seed'),
 ('0011110','Tyson Foods','US','seed'),
 ('0012000','J.M. Smucker Company','US','seed'),
 ('0013000','Dean Foods','US','seed'),
 ('0014000','Danone North America','US','seed'),
 ('0015000','Chobani','US','seed'),
 ('0016000','Blue Bell Creameries','US','seed'),
 ('0017000','Ben & Jerry''s','US','seed'),
 ('0018000','Häagen-Dazs','US','seed'),
 ('0019000','Dreyer''s','US','seed'),
 ('0020000','Starbucks','US','seed'),
 ('0021000','Dunkin'' Brands','US','seed'),
 ('0022000','Tim Hortons','US','seed'),
 ('0023000','Krispy Kreme','US','seed'),
 ('0024000','Panera Bread','US','seed'),
 ('0025000','Chipotle','US','seed'),
 ('0026000','Subway','US','seed'),
 ('0027000','McDonald''s','US','seed'),
 ('0028000','Burger King','US','seed'),
 ('0029000','Wendy''s','US','seed'),
 ('0030000','Taco Bell','US','seed'),
 ('0031000','KFC','US','seed'),
 ('0032000','Pizza Hut','US','seed'),
 ('0033000','Domino''s','US','seed'),
 ('0034000','Papa John''s','US','seed'),
 ('0035000','Little Caesars','US','seed'),
 ('0036000','Arby''s','US','seed'),
 ('0037000','Sonic Drive-In','US','seed'),
 ('0038000','Jack in the Box','US','seed'),
 ('0039000','Carl''s Jr.','US','seed'),
 ('0040000','Hardee''s','US','seed'),
 ('0041000','White Castle','US','seed'),
 ('0042000','Five Guys','US','seed'),
 ('0043000','In-N-Out Burger','US','seed'),
 ('0044000','Shake Shack','US','seed'),
 ('0045000','Culver''s','US','seed'),
 ('0046000','Whataburger','US','seed'),
 ('0047000','Popeyes','US','seed'),
 ('0048000','Chick-fil-A','US','seed'),
 ('0049000','Zaxby''s','US','seed'),
 ('0050000','Raising Cane''s','US','seed'),
 ('0051000','Wingstop','US','seed'),
 ('0052000','Buffalo Wild Wings','US','seed'),
 ('0053000','Panda Express','US','seed'),
 ('0054000','P.F. Chang''s','US','seed'),
 ('0055000','Olive Garden','US','seed'),
 ('0056000','Red Lobster','US','seed'),
 ('0057000','Outback Steakhouse','US','seed'),
 ('0058000','Texas Roadhouse','US','seed'),
 ('0059000','LongHorn Steakhouse','US','seed'),
 ('0060000','Cracker Barrel','US','seed'),
 ('0061000','Applebee''s','US','seed'),
 ('0062000','Chili''s','US','seed'),
 ('0063000','TGI Fridays','US','seed'),
 ('0064000','Red Robin','US','seed'),
 ('0065000','Denny''s','US','seed'),
 ('0066000','IHOP','US','seed'),
 ('0067000','Waffle House','US','seed'),
 ('0068000','Bob Evans','US','seed'),
 ('0069000','Perkins','US','seed'),
 ('0070000','The Cheesecake Factory','US','seed'),
 ('0071000','BJ''s Restaurant','US','seed'),
 ('0072000','California Pizza Kitchen','US','seed'),
 ('0073000','Maggiano''s','US','seed'),
 ('0074000','Romano''s Macaroni Grill','US','seed'),
 ('0075000','Carrabba''s','US','seed'),
 ('0076000','Bonefish Grill','US','seed'),
 ('0077000','Fleming''s Prime Steakhouse','US','seed'),
 ('0078000','Ruth''s Chris Steak House','US','seed'),
 ('0079000','Morton''s The Steakhouse','US','seed'),
 ('0080000','The Capital Grille','US','seed'),
 ('0081000','Del Monte Foods','US','seed'),
 ('0082000','Birds Eye Foods','US','seed'),
 ('0083000','Green Giant','US','seed'),
 ('0084000','Ocean Spray','US','seed'),
 ('0085000','Welch''s','US','seed'),
 ('0086000','Sunkist','US','seed'),
 ('0087000','Tropicana','US','seed'),
 ('0088000','Minute Maid','US','seed'),
 ('0089000','Simply Orange','US','seed')
on conflict (prefix) do nothing;
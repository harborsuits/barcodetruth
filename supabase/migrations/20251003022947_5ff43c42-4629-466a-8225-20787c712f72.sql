-- Prevent duplicate active claims per barcode/brand
create unique index if not exists uniq_active_claim
on public.product_claims (barcode_ean13, claimed_brand_id)
where status in ('pending','verified');

-- Moderator view with vote tallies
create or replace view public.product_claims_moderator as
select c.*,
       coalesce(sum(v.vote),0) as score,
       count(v.*) filter (where v.vote=1) as upvotes,
       count(v.*) filter (where v.vote=-1) as downvotes
from public.product_claims c
left join public.product_claim_votes v on v.claim_id=c.id
group by c.id;
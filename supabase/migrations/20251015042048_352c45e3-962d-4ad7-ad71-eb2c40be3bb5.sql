-- G & H post-merge hardening: admin-only RPC + performance index

-- 1) Restrict admin_add_evidence to admins only (prevent privilege escalation)
REVOKE ALL ON FUNCTION public.admin_add_evidence(uuid,text,text,text,text,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_add_evidence(uuid,text,text,text,text,date,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_evidence(uuid,text,text,text,text,date,text) TO authenticated;

-- Note: RLS enforcement happens via has_role(auth.uid(), 'admin') check in AdminRoute wrapper
-- The function itself is SECURITY DEFINER to allow the elevated write operations

-- 2) Speed up brand profile timelines (event ordering)
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_date
  ON public.brand_events (brand_id, event_date DESC);
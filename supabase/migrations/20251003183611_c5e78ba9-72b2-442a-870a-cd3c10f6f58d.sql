-- Fix security definer view by setting security_invoker = true
ALTER VIEW public.v_baseline_inputs_90d SET (security_invoker = true);
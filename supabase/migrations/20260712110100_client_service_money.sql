-- ============================================================
-- Phase 2A: finance-gated money RPC (Option A, per the plan's KEY DECISION).
-- project_service SELECT stays open to all org members for the non-money
-- fields (tier, site_type, metrics). The client UI reads price/ROI via THIS
-- finance-gated definer RPC and hides them from non-finance members.
-- RESIDUAL (accepted under Option A): project_service rows still physically
-- carry monthly_price/hourly_rate, so RLS (row-level) cannot hide them from a
-- non-finance member who queries the table directly. Fully closing this
-- (Option B: column-privilege revoke or a security-barrier view) is deferred
-- Phase-3 hardening, and MUST land before any can_finance=false member is
-- provisioned in Phase 2B. Mirrors the shape/guard style of client_service_summary().
-- ============================================================
create or replace function public.client_service_money(p_project uuid)
returns table(monthly_price numeric, hourly_rate numeric)
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not (public.is_admin() or public.member_can(p_project, 'finance')) then
    raise exception 'forbidden';
  end if;
  return query
    select ps.monthly_price, ps.hourly_rate
    from public.project_service ps
    where ps.project_id = p_project;
end;
$function$;

grant execute on function public.client_service_money(uuid) to authenticated;

notify pgrst, 'reload schema';

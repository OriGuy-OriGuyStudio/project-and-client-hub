-- ============================================================
-- Phase 2A: finance-gated money RPC (Option A).
-- project_service SELECT stays open to all org members for the non-money
-- fields (tier, site_type, metrics). The money columns (monthly_price /
-- hourly_rate) are read only through this finance-gated definer RPC, so a
-- non-finance member's service dashboard can show everything except price/ROI.
-- Mirrors the shape/guard style of client_service_summary().
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

-- ============================================================
-- Phase 2A: the current user's 4 capabilities on a project's org, in one call.
-- Admin -> all true (member_can already returns false for non-members).
-- UI helper (does not raise): a non-member simply gets all-false so the UI hides
-- the gated controls.
-- ============================================================
create or replace function public.my_capabilities(p_project uuid)
returns table(finance boolean, service_calls boolean, approve boolean, files boolean)
language plpgsql stable security definer set search_path to 'public' as $function$
declare v_admin boolean := public.is_admin();
begin
  return query select
    v_admin or public.member_can(p_project, 'finance'),
    v_admin or public.member_can(p_project, 'service_calls'),
    v_admin or public.member_can(p_project, 'approve'),
    v_admin or public.member_can(p_project, 'files');
end; $function$;

grant execute on function public.my_capabilities(uuid) to authenticated;

notify pgrst, 'reload schema';

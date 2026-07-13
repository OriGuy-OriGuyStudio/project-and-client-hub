-- Admin-only hard delete of a business (organization), guarded so it can only
-- remove an EMPTY business (no projects). Everything else that hangs off the org
-- is FK ON DELETE CASCADE (organization_members, client_brand, admin_client_notes,
-- client_call_logs, member_invite_requests, pending_members), so a single delete
-- of the org row cleans them up. Projects are ON DELETE SET NULL, so we refuse
-- when any exist rather than silently orphaning them; the admin must move or
-- delete the projects first.
create or replace function public.delete_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projects int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_projects from public.projects where org_id = p_org_id;
  if v_projects > 0 then
    raise exception 'לא ניתן למחוק עסק עם % פרויקטים. מחק או העבר את הפרויקטים קודם.', v_projects
      using errcode = 'P0001';
  end if;

  delete from public.organizations where id = p_org_id;
end;
$$;

revoke all on function public.delete_organization(uuid) from public, anon;
grant execute on function public.delete_organization(uuid) to authenticated;

-- Backfill: each existing client (role='client') -> a solo organization with a
-- manager membership (all capabilities on), and tag their projects/brand/notes.
do $$
declare c record; v_org uuid;
begin
  for c in
    select p.id as client_id,
           coalesce(nullif(btrim(cb.business_name), ''), nullif(btrim(p.full_name), ''), p.email) as name
    from public.profiles p
    left join public.client_brand cb on cb.client_id = p.id
    where p.role = 'client'
      and not exists (select 1 from public.organization_members m where m.user_id = p.id)
  loop
    insert into public.organizations (name) values (c.name) returning id into v_org;
    insert into public.organization_members
      (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
      values (v_org, c.client_id, true, true, true, true, true);
    update public.projects          set org_id = v_org where client_id = c.client_id and org_id is null;
    update public.client_brand       set org_id = v_org where client_id = c.client_id and org_id is null;
    update public.admin_client_notes set org_id = v_org where client_id = c.client_id and org_id is null;
  end loop;
end $$;

notify pgrst, 'reload schema';

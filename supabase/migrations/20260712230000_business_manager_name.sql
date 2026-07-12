-- The add-business flow was passing the BUSINESS name as the founding manager's
-- full_name, so a project's "responsible contact" displayed the business name
-- instead of the person. Add a separate p_manager_name (the contact person).
drop function if exists public.admin_create_business(text, text, text);

create or replace function public.admin_create_business(
  p_name text, p_manager_name text, p_manager_email text, p_kind text default 'real')
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_email text := lower(btrim(coalesce(p_manager_email,'')));
  v_manager text := btrim(coalesce(p_manager_name,''));
  v_org uuid; v_uid uuid; v_existing_org uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if btrim(coalesce(p_name,'')) = '' then raise exception 'empty name'; end if;
  if v_manager = '' then raise exception 'empty manager name'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'invalid email'; end if;
  -- existing-email guard: do not create a 2nd-org membership silently.
  select id into v_uid from public.profiles where lower(email) = v_email;
  if v_uid is not null then
    select m.org_id into v_existing_org from public.organization_members m where m.user_id = v_uid limit 1;
    if v_existing_org is not null then
      return jsonb_build_object('status', 'email_exists', 'org_id', v_existing_org);
    end if;
  end if;
  insert into public.organizations (name, kind)
    values (btrim(p_name), coalesce(nullif(p_kind, ''), 'real')) returning id into v_org;
  -- founding manager with all capabilities, named by the CONTACT PERSON (not the business).
  perform public.admin_add_org_member(v_org, v_email, v_manager, true, true, true, true, true);
  return jsonb_build_object('status', 'created', 'org_id', v_org);
end; $function$;
grant execute on function public.admin_create_business(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

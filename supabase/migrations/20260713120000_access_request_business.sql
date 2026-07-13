-- Onboarding fix: approving a portal access request must create a BUSINESS
-- (organization) + founding manager, not just a bare client. In the org-centric
-- model a client with no org can't be linked to projects or shown in the
-- businesses list, which is why past approvals produced orphaned clients.
--
-- 1) approve_access_request_as_business: reuses admin_create_business (same path
--    as "add business"), so the requester's email is whitelisted, an org is
--    created, and they become its founding manager. The admin confirms/edits the
--    business + manager name in a preview before this runs.
-- 2) convert_client_to_business: retrofits an already-approved orphan client
--    (approved before this flow existed) into a business, linking their existing
--    brand + projects to the new org.

create or replace function public.approve_access_request_as_business(
  p_id uuid,
  p_business_name text,
  p_manager_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
  v_biz text := btrim(coalesce(p_business_name, ''));
  v_mgr text := btrim(coalesce(p_manager_name, ''));
  v_res jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_biz = '' then raise exception 'צריך שם עסק'; end if;
  if v_mgr = '' then raise exception 'צריך שם מנהל'; end if;

  select lower(email), phone into v_email, v_phone
    from public.access_requests where id = p_id;
  if v_email is null then raise exception 'הבקשה לא נמצאה'; end if;

  -- Creates the org + whitelists the email + adds them as founding manager.
  -- Returns { status: 'created' | 'email_exists', org_id }.
  v_res := public.admin_create_business(v_biz, v_mgr, v_email, 'real');

  -- If the requester already has a profile, keep their phone from the request.
  update public.profiles set phone = coalesce(phone, v_phone)
    where lower(email) = v_email;

  update public.access_requests
    set status = 'approved', handled_at = now(), handled_by = auth.uid()
    where id = p_id;

  return v_res;
end;
$$;

revoke all on function public.approve_access_request_as_business(uuid, text, text) from public, anon;
grant execute on function public.approve_access_request_as_business(uuid, text, text) to authenticated;

create or replace function public.convert_client_to_business(
  p_client_id uuid,
  p_business_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_role text;
  v_biz text := btrim(coalesce(p_business_name, ''));
  v_org uuid;
  v_existing uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_biz = '' then raise exception 'צריך שם עסק'; end if;

  select lower(email), role into v_email, v_role
    from public.profiles where id = p_client_id;
  if v_email is null then raise exception 'הלקוח לא נמצא'; end if;
  if v_role <> 'client' then raise exception 'רק לקוח ניתן להמיר לעסק'; end if;

  -- Already belongs to an org: nothing to do.
  select org_id into v_existing
    from public.organization_members where user_id = p_client_id limit 1;
  if v_existing is not null then
    return jsonb_build_object('status', 'already_member', 'org_id', v_existing);
  end if;

  insert into public.organizations (name, kind)
    values (v_biz, 'real') returning id into v_org;

  -- Membership FIRST (the project-contact trigger requires the client to be a
  -- member of the project's org before we can point projects at it).
  insert into public.organization_members
    (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
    values (v_org, p_client_id, true, true, true, true, true);

  -- Link the client's existing brand + orphaned projects to the new org.
  update public.client_brand
    set org_id = v_org, is_org_primary = true
    where client_id = p_client_id and org_id is null;
  update public.projects
    set org_id = v_org
    where client_id = p_client_id and org_id is null;

  return jsonb_build_object('status', 'created', 'org_id', v_org);
end;
$$;

revoke all on function public.convert_client_to_business(uuid, text) from public, anon;
grant execute on function public.convert_client_to_business(uuid, text) to authenticated;

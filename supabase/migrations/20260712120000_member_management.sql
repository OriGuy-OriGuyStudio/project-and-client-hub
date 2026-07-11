-- ============================================================
-- Phase 2B: member management + the manager invite-request flow.
-- The studio (admin) manages an org's members and their capabilities; a business
-- manager can REQUEST to add a teammate, which the admin approves/rejects.
-- Materialization of an invited email into organization_members happens on the
-- invitee's first Google login via handle_new_user/ensure_my_profile (Phase 2A).
-- ============================================================

create table if not exists public.member_invite_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  requested_by uuid not null references public.profiles(id),
  full_name text,
  email text not null,
  phone text,
  req_can_finance boolean not null default false,
  req_can_service_calls boolean not null default false,
  req_can_approve boolean not null default false,
  req_can_files boolean not null default false,
  note text,
  status text not null default 'pending',        -- pending / approved / rejected
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references public.profiles(id)
);
alter table public.member_invite_requests enable row level security;

drop policy if exists mir_admin on public.member_invite_requests;
create policy mir_admin on public.member_invite_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists mir_manager_read on public.member_invite_requests;
create policy mir_manager_read on public.member_invite_requests
  for select to authenticated using ((select public.is_org_manager(org_id)));

-- ---- admin: add a member to an org ----------------------------------------
-- If the email already has a profile, add the membership now; otherwise
-- whitelist + queue a pending membership (materialized on first login).
create or replace function public.admin_add_org_member(
  p_org uuid, p_email text, p_full_name text,
  p_is_manager boolean, p_finance boolean, p_service_calls boolean, p_approve boolean, p_files boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_email text := lower(btrim(coalesce(p_email,''))); v_uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'invalid email'; end if;
  select id into v_uid from public.profiles where lower(email) = v_email;
  if v_uid is not null then
    insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
      values (p_org, v_uid, coalesce(p_is_manager,false), coalesce(p_finance,false), coalesce(p_service_calls,false), coalesce(p_approve,false), coalesce(p_files,false))
      on conflict (org_id, user_id) do update set
        is_manager = excluded.is_manager, can_finance = excluded.can_finance,
        can_service_calls = excluded.can_service_calls, can_approve = excluded.can_approve, can_files = excluded.can_files;
  else
    insert into public.allowed_emails (email, role, full_name, invited_by)
      values (v_email, 'client', nullif(btrim(coalesce(p_full_name,'')),''), auth.uid())
      on conflict (email) do nothing;
    insert into public.pending_members (org_id, email, is_manager, can_finance, can_service_calls, can_approve, can_files)
      values (p_org, v_email, coalesce(p_is_manager,false), coalesce(p_finance,false), coalesce(p_service_calls,false), coalesce(p_approve,false), coalesce(p_files,false))
      on conflict (org_id, email) do update set
        is_manager = excluded.is_manager, can_finance = excluded.can_finance,
        can_service_calls = excluded.can_service_calls, can_approve = excluded.can_approve, can_files = excluded.can_files;
  end if;
end; $function$;
grant execute on function public.admin_add_org_member(uuid,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- ---- admin: set a member's capabilities -----------------------------------
create or replace function public.set_member_capabilities(
  p_member_id uuid, p_is_manager boolean, p_finance boolean, p_service_calls boolean, p_approve boolean, p_files boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.organization_members set
    is_manager = coalesce(p_is_manager,false), can_finance = coalesce(p_finance,false),
    can_service_calls = coalesce(p_service_calls,false), can_approve = coalesce(p_approve,false),
    can_files = coalesce(p_files,false)
  where id = p_member_id;
end; $function$;
grant execute on function public.set_member_capabilities(uuid,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- ---- admin: remove a member (never the org's last manager) -----------------
create or replace function public.remove_org_member(p_member_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_is_mgr boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select org_id, is_manager into v_org, v_is_mgr from public.organization_members where id = p_member_id;
  if v_org is null then return; end if;
  if v_is_mgr and (select count(*) from public.organization_members where org_id = v_org and is_manager) <= 1 then
    raise exception 'cannot remove the last manager';
  end if;
  delete from public.organization_members where id = p_member_id;
end; $function$;
grant execute on function public.remove_org_member(uuid) to authenticated;

-- ---- manager: request to add a teammate (notifies the studio) --------------
create or replace function public.request_member_invite(
  p_full_name text, p_email text, p_phone text, p_note text,
  p_finance boolean, p_service_calls boolean, p_approve boolean, p_files boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid; v_id uuid; v_email text := lower(btrim(coalesce(p_email,''))); v_name text; v_mgr text;
begin
  select org_id into v_org from public.organization_members
    where user_id = auth.uid() and is_manager order by created_at limit 1;
  if v_org is null then raise exception 'forbidden'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'invalid email'; end if;
  v_name := nullif(btrim(coalesce(p_full_name,'')),'');
  insert into public.member_invite_requests
    (org_id, requested_by, full_name, email, phone, req_can_finance, req_can_service_calls, req_can_approve, req_can_files, note)
    values (v_org, auth.uid(), v_name, v_email, nullif(btrim(coalesce(p_phone,'')),''),
            coalesce(p_finance,false), coalesce(p_service_calls,false), coalesce(p_approve,false), coalesce(p_files,false),
            nullif(btrim(coalesce(p_note,'')),''))
    returning id into v_id;
  select coalesce(nullif(btrim(pr.full_name),''), pr.email) into v_mgr from public.profiles pr where pr.id = auth.uid();
  insert into public.notifications (audience, recipient_id, type, title, body, link, entity_id)
    values ('admin', null, 'member_invite',
      'בקשה להוספת איש צוות' || coalesce(' מ' || v_mgr,''),
      coalesce(v_name || ' · ','') || v_email, '/admin', v_id);
  return v_id;
end; $function$;
grant execute on function public.request_member_invite(text,text,text,text,boolean,boolean,boolean,boolean) to authenticated;

-- ---- admin: approve a request (adds the member with adjusted caps) ---------
create or replace function public.approve_member_invite(
  p_id uuid, p_is_manager boolean, p_finance boolean, p_service_calls boolean, p_approve boolean, p_files boolean)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_req record;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into v_req from public.member_invite_requests where id = p_id and status = 'pending';
  if v_req.id is null then raise exception 'not found or already handled'; end if;
  perform public.admin_add_org_member(v_req.org_id, v_req.email, v_req.full_name,
    coalesce(p_is_manager,false), coalesce(p_finance,false), coalesce(p_service_calls,false), coalesce(p_approve,false), coalesce(p_files,false));
  update public.member_invite_requests set status='approved', handled_at=now(), handled_by=auth.uid() where id = p_id;
end; $function$;
grant execute on function public.approve_member_invite(uuid,boolean,boolean,boolean,boolean,boolean) to authenticated;

-- ---- admin: reject a request ----------------------------------------------
create or replace function public.reject_member_invite(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.member_invite_requests set status='rejected', handled_at=now(), handled_by=auth.uid()
  where id = p_id and status='pending';
end; $function$;
grant execute on function public.reject_member_invite(uuid) to authenticated;

-- ---- manager/admin: list the caller's org members + pending invites --------
-- profiles RLS blocks a manager from reading teammates' rows, so expose the
-- names through this definer RPC.
create or replace function public.my_org_members()
returns table(member_id uuid, user_id uuid, full_name text, email text, is_manager boolean,
  can_finance boolean, can_service_calls boolean, can_approve boolean, can_files boolean, is_pending boolean, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid;
begin
  -- alias the table: user_id/is_manager are also OUT column names on this fn.
  select om.org_id into v_org from public.organization_members om
    where om.user_id = auth.uid() and om.is_manager order by om.created_at limit 1;
  if v_org is null then return; end if;
  return query
    select m.id, m.user_id, coalesce(nullif(btrim(pr.full_name),''), pr.email), pr.email,
           m.is_manager, m.can_finance, m.can_service_calls, m.can_approve, m.can_files, false, m.created_at
    from public.organization_members m join public.profiles pr on pr.id = m.user_id
    where m.org_id = v_org
    union all
    select null::uuid, null::uuid, pm.email, pm.email,
           pm.is_manager, pm.can_finance, pm.can_service_calls, pm.can_approve, pm.can_files, true, pm.created_at
    from public.pending_members pm where pm.org_id = v_org
    order by 10, 11;  -- is_pending, then created_at (positional: UNION needs names/positions)
end; $function$;
grant execute on function public.my_org_members() to authenticated;

-- admin: list a SPECIFIC org's members + pending invites (for the client card).
create or replace function public.admin_org_members(p_org uuid)
returns table(member_id uuid, user_id uuid, full_name text, email text, is_manager boolean,
  can_finance boolean, can_service_calls boolean, can_approve boolean, can_files boolean, is_pending boolean, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select m.id, m.user_id, coalesce(nullif(btrim(pr.full_name),''), pr.email), pr.email,
           m.is_manager, m.can_finance, m.can_service_calls, m.can_approve, m.can_files, false, m.created_at
    from public.organization_members m join public.profiles pr on pr.id = m.user_id
    where m.org_id = p_org
    union all
    select null::uuid, null::uuid, pm.email, pm.email,
           pm.is_manager, pm.can_finance, pm.can_service_calls, pm.can_approve, pm.can_files, true, pm.created_at
    from public.pending_members pm where pm.org_id = p_org
    order by 10, 11;
end; $function$;
grant execute on function public.admin_org_members(uuid) to authenticated;

notify pgrst, 'reload schema';

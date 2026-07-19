-- Attaching people to a business, two gaps closed:
--   1. An EXISTING user could only be attached by typing their email exactly
--      (admin_add_org_member matches on email). Now the admin picks them from
--      a list and we attach by id.
--   2. A PARTNER (שת"פ) could not be attached at all in practice: the member
--      capabilities never covered "may open the service dashboard", and the
--      partner has no client home to see it from.
--
-- A partner attached to a business is a MEMBER like any other, with the same
-- per-capability toggles, plus the new `can_service_view`. Their own lead flow
-- (partner_leads) is deliberately untouched and no lead path is exposed
-- through the business, so a business they help never mixes into their own
-- referral pipeline.

-- Existing members already reach the service dashboard, so default true keeps
-- today's behavior; partners are added with it explicitly set by the admin.
alter table public.organization_members
  add column if not exists can_service_view boolean not null default true;

alter table public.pending_members
  add column if not exists can_service_view boolean not null default true;

-- ---- attach an existing user (client or partner) by id ---------------------
create or replace function public.admin_attach_org_member(
  p_org uuid, p_user_id uuid,
  p_is_manager boolean default false, p_finance boolean default false,
  p_service_calls boolean default false, p_approve boolean default false,
  p_files boolean default false, p_service_view boolean default false)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_role text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_org is null or p_user_id is null then raise exception 'missing org or user'; end if;

  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null then return jsonb_build_object('ok', false, 'error', 'no_profile'); end if;
  -- The studio's own admin account is never a member of a client business.
  if v_role = 'admin' then return jsonb_build_object('ok', false, 'error', 'is_admin'); end if;
  -- A partner is never a manager of a client's business: managing implies
  -- billing and team control, which belong to the client.
  if v_role = 'partner' and coalesce(p_is_manager, false) then
    return jsonb_build_object('ok', false, 'error', 'partner_cannot_manage');
  end if;

  insert into public.organization_members (
    org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files, can_service_view)
  values (
    p_org, p_user_id, coalesce(p_is_manager,false), coalesce(p_finance,false),
    coalesce(p_service_calls,false), coalesce(p_approve,false), coalesce(p_files,false),
    coalesce(p_service_view,false))
  on conflict (org_id, user_id) do update set
    is_manager = excluded.is_manager, can_finance = excluded.can_finance,
    can_service_calls = excluded.can_service_calls, can_approve = excluded.can_approve,
    can_files = excluded.can_files, can_service_view = excluded.can_service_view;

  return jsonb_build_object('ok', true, 'role', v_role);
end; $$;

revoke all on function public.admin_attach_org_member(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_attach_org_member(uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ---- candidates to attach (admin picker) -----------------------------------
-- Everyone who can be attached to this org, with the ones already attached
-- flagged, so the picker can show them as "כבר משויך" instead of hiding them.
create or replace function public.admin_attach_candidates(p_org uuid)
returns table(user_id uuid, full_name text, email text, role text, already_member boolean)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id,
           coalesce(nullif(btrim(p.full_name), ''), p.email),
           p.email,
           p.role,
           exists (select 1 from public.organization_members m
                   where m.org_id = p_org and m.user_id = p.id)
    from public.profiles p
    where p.role in ('client', 'partner')
    order by p.role, 2;
end; $$;

revoke all on function public.admin_attach_candidates(uuid) from public, anon;
grant execute on function public.admin_attach_candidates(uuid) to authenticated;

-- ---- member lists now carry role + the new capability ----------------------
-- The OUT columns change, and Postgres will not redefine a set-returning
-- function's row type in place.
drop function if exists public.admin_org_members(uuid);
create or replace function public.admin_org_members(p_org uuid)
returns table(member_id uuid, user_id uuid, full_name text, email text, role text, is_manager boolean,
  can_finance boolean, can_service_calls boolean, can_approve boolean, can_files boolean,
  can_service_view boolean, is_pending boolean, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select m.id, m.user_id, coalesce(nullif(btrim(pr.full_name),''), pr.email), pr.email, pr.role,
           m.is_manager, m.can_finance, m.can_service_calls, m.can_approve, m.can_files,
           m.can_service_view, false, m.created_at
    from public.organization_members m join public.profiles pr on pr.id = m.user_id
    where m.org_id = p_org
    union all
    select null::uuid, null::uuid, pm.email, pm.email, 'client'::text,
           pm.is_manager, pm.can_finance, pm.can_service_calls, pm.can_approve, pm.can_files,
           pm.can_service_view, true, pm.created_at
    from public.pending_members pm where pm.org_id = p_org
    order by 12, 13;  -- is_pending, then created_at
end; $$;

-- Adding a defaulted argument would make the 6-arg call ambiguous, so replace
-- the old signature outright.
drop function if exists public.set_member_capabilities(uuid, boolean, boolean, boolean, boolean, boolean);
create or replace function public.set_member_capabilities(
  p_member_id uuid, p_is_manager boolean, p_finance boolean,
  p_service_calls boolean, p_approve boolean, p_files boolean,
  p_service_view boolean default null)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_role text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select pr.role into v_role
    from public.organization_members m join public.profiles pr on pr.id = m.user_id
    where m.id = p_member_id;
  if v_role = 'partner' and coalesce(p_is_manager, false) then
    raise exception 'partner_cannot_manage';
  end if;

  update public.organization_members set
    is_manager = coalesce(p_is_manager, false),
    can_finance = coalesce(p_finance, false),
    can_service_calls = coalesce(p_service_calls, false),
    can_approve = coalesce(p_approve, false),
    can_files = coalesce(p_files, false),
    -- null keeps the current value, so older callers stay correct.
    can_service_view = coalesce(p_service_view, can_service_view)
  where id = p_member_id;
end; $$;

-- ---- the partner portal's "העסקים שלי" tab ---------------------------------
-- Businesses the CALLER is a member of, with what they may see. Used by the
-- partner portal; safe for any role since it only ever returns the caller's
-- own memberships.
create or replace function public.my_member_orgs()
returns table(org_id uuid, org_name text, can_service_view boolean, can_service_calls boolean,
  can_files boolean, can_approve boolean, can_finance boolean, project_id uuid, project_title text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  return query
    select o.id, o.name, m.can_service_view, m.can_service_calls, m.can_files, m.can_approve,
           m.can_finance,
           -- the org's most recent project, which the service dashboard is keyed on
           (select pr.id from public.projects pr where pr.org_id = o.id
             order by pr.created_at desc limit 1),
           (select pr.title from public.projects pr where pr.org_id = o.id
             order by pr.created_at desc limit 1)
    from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
    order by o.name;
end; $$;

grant execute on function public.my_member_orgs() to authenticated;

notify pgrst, 'reload schema';

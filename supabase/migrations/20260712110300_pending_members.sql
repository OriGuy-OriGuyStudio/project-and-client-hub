-- ============================================================
-- Phase 2A: pending_members + client auth linkage.
-- (1) pending_members: an invited email's future membership (org + caps),
--     materialized into organization_members on first sign-in / next login.
-- (2) handle_new_user() + ensure_my_profile(): on client onboarding —
--     (a) materialize any pending membership(s) into the existing org, else
--     (b) create a solo org + full-cap manager membership for a brand-new client;
--     then attach client_brand to that org. Closes the Phase-1 gap where new
--     clients got no org (they only worked via the projects client_id fallback).
-- ============================================================

create table if not exists public.pending_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  email text not null,
  is_manager boolean not null default false,
  can_finance boolean not null default false,
  can_service_calls boolean not null default false,
  can_approve boolean not null default false,
  can_files boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);
alter table public.pending_members enable row level security;

drop policy if exists pending_members_admin on public.pending_members;
create policy pending_members_admin on public.pending_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists pending_members_manager_read on public.pending_members;
create policy pending_members_manager_read on public.pending_members
  for select to authenticated using ((select public.is_org_manager(org_id)));

-- ---- handle_new_user: profile + client org-linkage on signup ----
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_role text; v_full_name text; v_business_name text; v_gender text;
  v_rate numeric(5,2); v_min numeric(5,2); v_max numeric(5,2); v_notes text;
  v_org uuid;
begin
  select role, coalesce(full_name,''), business_name, gender, commission_rate, commission_rate_min, commission_rate_max, commission_notes
    into v_role, v_full_name, v_business_name, v_gender, v_rate, v_min, v_max, v_notes
  from public.allowed_emails where lower(email) = lower(new.email);
  if v_role is null then return new; end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, gender)
  values (new.id, new.email,
    coalesce(nullif(v_full_name,''), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url', v_role, v_gender)
  on conflict (id) do nothing;

  if v_role = 'client' then
    -- (a) invited member: materialize pending membership(s) into the org.
    insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
    select pm.org_id, new.id, pm.is_manager, pm.can_finance, pm.can_service_calls, pm.can_approve, pm.can_files
    from public.pending_members pm where lower(pm.email) = lower(new.email)
    on conflict (org_id, user_id) do nothing;
    delete from public.pending_members where lower(email) = lower(new.email);

    -- (b) brand-new solo client (no membership yet): create org + manager membership.
    if not exists (select 1 from public.organization_members m where m.user_id = new.id) then
      insert into public.organizations (name)
        values (coalesce(nullif(v_business_name,''), nullif(v_full_name,''), new.email))
        returning id into v_org;
      insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
        values (v_org, new.id, true, true, true, true, true);
    end if;

    -- brand: attach to the user's org (first membership).
    insert into public.client_brand (client_id, business_name, org_id)
    values (new.id, v_business_name, (select org_id from public.organization_members m where m.user_id = new.id order by created_at limit 1))
    on conflict (client_id) do update set org_id = excluded.org_id where public.client_brand.org_id is null;
  elsif v_role = 'partner' then
    insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, commission_notes, referral_code)
    values (new.id, coalesce(v_rate,5.0), coalesce(v_min, v_rate, 5.0), coalesce(v_max, v_rate, 5.0), v_notes, encode(extensions.gen_random_bytes(6),'hex'))
    on conflict (id) do nothing;
  end if;
  return new;
end; $function$;

-- ---- ensure_my_profile: same client org-linkage on every login ----
-- (called from useAuth each login; covers a member whitelisted/invited AFTER
--  their first login). Idempotent for clients who already have an org.
create or replace function public.ensure_my_profile()
returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid();
  v_email text; v_meta jsonb; v_role text;
  v_full_name text; v_business_name text; v_gender text;
  v_rate numeric(5,2); v_min numeric(5,2); v_max numeric(5,2); v_notes text;
  v_org uuid;
begin
  if v_uid is null then return null; end if;

  select email, raw_user_meta_data into v_email, v_meta from auth.users where id = v_uid;
  select role into v_role from public.profiles where id = v_uid;

  if v_role is null then
    -- first login: read whitelist and create the profile.
    select role, coalesce(full_name,''), business_name, gender, commission_rate, commission_rate_min, commission_rate_max, commission_notes
      into v_role, v_full_name, v_business_name, v_gender, v_rate, v_min, v_max, v_notes
    from public.allowed_emails where lower(email) = lower(v_email);
    if v_role is null then return null; end if;

    insert into public.profiles (id, email, full_name, avatar_url, role, gender)
    values (v_uid, v_email,
      coalesce(nullif(v_full_name,''), v_meta->>'full_name', v_meta->>'name'),
      v_meta->>'avatar_url', v_role, v_gender)
    on conflict (id) do nothing;

    if v_role = 'partner' then
      insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, commission_notes, referral_code)
      values (v_uid, coalesce(v_rate,5.0), coalesce(v_min, v_rate, 5.0), coalesce(v_max, v_rate, 5.0), v_notes, encode(extensions.gen_random_bytes(6),'hex'))
      on conflict (id) do nothing;
    end if;
  end if;

  if v_role = 'client' then
    if v_business_name is null then
      select business_name into v_business_name from public.allowed_emails where lower(email) = lower(v_email);
    end if;

    -- (a) materialize pending membership(s)
    insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
    select pm.org_id, v_uid, pm.is_manager, pm.can_finance, pm.can_service_calls, pm.can_approve, pm.can_files
    from public.pending_members pm where lower(pm.email) = lower(v_email)
    on conflict (org_id, user_id) do nothing;
    delete from public.pending_members where lower(email) = lower(v_email);

    -- (b) brand-new solo client with no membership: create org + manager membership.
    if not exists (select 1 from public.organization_members m where m.user_id = v_uid) then
      insert into public.organizations (name)
        values (coalesce(nullif(v_business_name,''), nullif((select full_name from public.profiles where id = v_uid),''), v_email))
        returning id into v_org;
      insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
        values (v_org, v_uid, true, true, true, true, true);
    end if;

    -- attach brand to the user's org (first membership).
    insert into public.client_brand (client_id, business_name, org_id)
    values (v_uid, v_business_name, (select org_id from public.organization_members m where m.user_id = v_uid order by created_at limit 1))
    on conflict (client_id) do update set org_id = excluded.org_id where public.client_brand.org_id is null;
  end if;

  return v_role;
end; $function$;

notify pgrst, 'reload schema';

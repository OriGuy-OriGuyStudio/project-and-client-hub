-- Org-centric admin (task 9): stop creating a client_brand row for every
-- client's first login. Only the founding member of a brand-new solo org
-- (block b) gets one, and it is marked is_org_primary = true. An invited
-- member materialized into an existing org (block a) gets no brand row at
-- all. Byte-identical otherwise to the current handle_new_user /
-- ensure_my_profile bodies (fetched via pg_get_functiondef before editing);
-- only the client_brand insert moved inside the "no membership yet" branch
-- and gained is_org_primary => true.

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

    -- (b) brand-new solo client (no membership yet): create org + manager
    -- membership + the org's one primary brand row. Only the founding
    -- member of a brand-new org gets a client_brand row; an invited member
    -- materialized above in (a) does not.
    if not exists (select 1 from public.organization_members m where m.user_id = new.id) then
      insert into public.organizations (name)
        values (coalesce(nullif(v_business_name,''), nullif(v_full_name,''), new.email))
        returning id into v_org;
      insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
        values (v_org, new.id, true, true, true, true, true);

      insert into public.client_brand (client_id, business_name, org_id, is_org_primary)
      values (new.id, v_business_name, v_org, true)
      on conflict (client_id) do update set org_id = excluded.org_id, is_org_primary = true where public.client_brand.org_id is null;
    end if;
  elsif v_role = 'partner' then
    insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, commission_notes, referral_code)
    values (new.id, coalesce(v_rate,5.0), coalesce(v_min, v_rate, 5.0), coalesce(v_max, v_rate, 5.0), v_notes, encode(extensions.gen_random_bytes(6),'hex'))
    on conflict (id) do nothing;
  end if;
  return new;
end; $function$;

create or replace function public.ensure_my_profile()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

    -- (b) brand-new solo client with no membership: create org + manager
    -- membership + the org's one primary brand row. Only the founding
    -- member of a brand-new org gets a client_brand row; an invited member
    -- materialized above in (a) does not.
    if not exists (select 1 from public.organization_members m where m.user_id = v_uid) then
      insert into public.organizations (name)
        values (coalesce(nullif(v_business_name,''), nullif((select full_name from public.profiles where id = v_uid),''), v_email))
        returning id into v_org;
      insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
        values (v_org, v_uid, true, true, true, true, true);

      insert into public.client_brand (client_id, business_name, org_id, is_org_primary)
      values (v_uid, v_business_name, v_org, true)
      on conflict (client_id) do update set org_id = excluded.org_id, is_org_primary = true where public.client_brand.org_id is null;
    end if;
  end if;

  return v_role;
end; $function$;

notify pgrst, 'reload schema';

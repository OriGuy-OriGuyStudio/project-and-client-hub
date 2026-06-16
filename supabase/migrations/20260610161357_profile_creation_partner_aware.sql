-- ============================================================
-- profile_creation_partner_aware
-- Backfilled from live prod (was applied via MCP, no committed file).
-- Makes signup profile-creation partner-aware: handle_new_user() (auth.users
-- trigger) and ensure_my_profile() (self-heal RPC) read role + commission from
-- allowed_emails and create the matching client_brand / partner_profiles row.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_role text; v_full_name text; v_business_name text;
  v_rate numeric(5,2); v_min numeric(5,2); v_max numeric(5,2); v_notes text;
begin
  select role, coalesce(full_name,''), business_name, commission_rate, commission_rate_min, commission_rate_max, commission_notes
    into v_role, v_full_name, v_business_name, v_rate, v_min, v_max, v_notes
  from public.allowed_emails where lower(email) = lower(new.email);
  if v_role is null then return new; end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (new.id, new.email,
    coalesce(nullif(v_full_name,''), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url', v_role)
  on conflict (id) do nothing;

  if v_role = 'client' then
    insert into public.client_brand (client_id, business_name)
    values (new.id, v_business_name) on conflict (client_id) do nothing;
  elsif v_role = 'partner' then
    insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, commission_notes, referral_code)
    values (new.id, coalesce(v_rate,5.0), coalesce(v_min, v_rate, 5.0), coalesce(v_max, v_rate, 5.0), v_notes, encode(extensions.gen_random_bytes(6),'hex'))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$function$;

create or replace function public.ensure_my_profile()
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text; v_meta jsonb; v_role text;
  v_full_name text; v_business_name text;
  v_rate numeric(5,2); v_min numeric(5,2); v_max numeric(5,2); v_notes text;
begin
  if v_uid is null then return null; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is not null then return v_role; end if;

  select email, raw_user_meta_data into v_email, v_meta from auth.users where id = v_uid;
  select role, coalesce(full_name,''), business_name, commission_rate, commission_rate_min, commission_rate_max, commission_notes
    into v_role, v_full_name, v_business_name, v_rate, v_min, v_max, v_notes
  from public.allowed_emails where lower(email) = lower(v_email);
  if v_role is null then return null; end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (v_uid, v_email,
    coalesce(nullif(v_full_name,''), v_meta->>'full_name', v_meta->>'name'),
    v_meta->>'avatar_url', v_role)
  on conflict (id) do nothing;

  if v_role = 'client' then
    insert into public.client_brand (client_id, business_name)
    values (v_uid, v_business_name) on conflict (client_id) do nothing;
  elsif v_role = 'partner' then
    insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, commission_notes, referral_code)
    values (v_uid, coalesce(v_rate,5.0), coalesce(v_min, v_rate, 5.0), coalesce(v_max, v_rate, 5.0), v_notes, encode(extensions.gen_random_bytes(6),'hex'))
    on conflict (id) do nothing;
  end if;
  return v_role;
end;
$function$;

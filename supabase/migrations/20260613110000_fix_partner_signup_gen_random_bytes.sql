-- ============================================================
-- Fix: partner signup failed with "function gen_random_bytes(integer)
-- does not exist", which rolled back the whole auth.users insert and
-- bounced the user back to the login page (no profile, no auth row).
--
-- Root cause: handle_new_user() / ensure_my_profile() run with
-- `SET search_path = public`, but pgcrypto's gen_random_bytes lives in the
-- `extensions` schema. The partner branch (referral_code generation) is the
-- only path that calls it, so clients/admins signed in fine and only new
-- partners failed. Fix: schema-qualify the call as extensions.gen_random_bytes.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
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
returns text language plpgsql security definer set search_path = public
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

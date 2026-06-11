-- ============================================================
-- 0008 — Self-healing profile creation
-- ============================================================
-- The on_auth_user_created trigger only fires on the FIRST sign-in. A user
-- whitelisted AFTER they first signed in would be stuck with no profile.
-- ensure_my_profile() is called by the app on every sign-in and creates the
-- profile (+ brand shell) for any whitelisted user who is still missing one.
-- ============================================================

create or replace function public.ensure_my_profile()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_email         text;
  v_meta          jsonb;
  v_role          text;
  v_full_name     text;
  v_business_name text;
begin
  if v_uid is null then
    return null;
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is not null then
    return v_role;
  end if;

  select email, raw_user_meta_data into v_email, v_meta
  from auth.users where id = v_uid;

  select role, coalesce(full_name, ''), business_name
    into v_role, v_full_name, v_business_name
  from public.allowed_emails
  where lower(email) = lower(v_email);

  if v_role is null then
    return null;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    v_uid,
    v_email,
    coalesce(nullif(v_full_name, ''), v_meta ->> 'full_name', v_meta ->> 'name'),
    v_meta ->> 'avatar_url',
    v_role
  )
  on conflict (id) do nothing;

  if v_role = 'client' then
    insert into public.client_brand (client_id, business_name)
    values (v_uid, v_business_name)
    on conflict (client_id) do nothing;
  end if;

  return v_role;
end;
$$;

revoke execute on function public.ensure_my_profile() from anon;
grant execute on function public.ensure_my_profile() to authenticated;

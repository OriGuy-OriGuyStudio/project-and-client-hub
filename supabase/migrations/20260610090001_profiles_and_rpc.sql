-- ============================================================
-- 0001 — Profiles, email whitelist, security RPCs, signup trigger
-- ============================================================
-- Security model:
--   * profiles.id == auth.users.id  (so RLS can compare client_id = auth.uid()).
--   * Profiles are created ONLY on first sign-in, and ONLY if the email is
--     pre-approved in allowed_emails (or is the studio admin). Unknown emails
--     get no profile -> every RLS policy denies them -> UI shows AccessDenied.
--   * Role is read server-side via get_my_role()/is_admin(), never from client
--     claims.
-- ============================================================

create extension if not exists pgcrypto;

-- ---- Shared helper: keep updated_at fresh -------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- Whitelist of emails the admin has pre-approved ---------
create table public.allowed_emails (
  email         text primary key,
  role          text not null default 'client' check (role in ('admin', 'client')),
  full_name     text,
  business_name text,
  invited_by    uuid references auth.users on delete set null,
  invited_at    timestamptz not null default now()
);

-- ---- Profiles (extends auth.users) -------------------------
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text unique not null,
  full_name  text,
  avatar_url text,
  phone      text,
  role       text not null default 'client' check (role in ('admin', 'client')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Security-critical functions
-- SECURITY DEFINER + reading profiles directly avoids RLS recursion
-- (policies call these while themselves guarding profiles).
-- ============================================================

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- NOTE: get_client_credits() and owns_project() reference tables created in
-- later migrations. Because SQL-language function bodies are validated at
-- creation time, they are defined in 0004 (after all tables exist).

-- ============================================================
-- Sign-up handler: gate profile creation on the whitelist.
-- Runs as definer on auth.users INSERT.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role          text;
  v_full_name     text;
  v_business_name text;
begin
  -- Resolve role/details from the whitelist (admin row also lives there).
  select role, coalesce(full_name, ''), business_name
    into v_role, v_full_name, v_business_name
  from public.allowed_emails
  where lower(email) = lower(new.email);

  -- Not whitelisted -> create no profile -> access denied downstream.
  if v_role is null then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(v_full_name, ''), new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_role
  )
  on conflict (id) do nothing;

  -- Seed a brand shell so the admin can immediately fill business identity.
  if v_role = 'client' then
    insert into public.client_brand (client_id, business_name)
    values (new.id, v_business_name)
    on conflict (client_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

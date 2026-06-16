-- ============================================================
-- 0040 — Access requests ("join" flow)
-- A signed-in user who isn't whitelisted lands on /access-denied and can
-- submit a request. It becomes an admin task; one click ("הקם לקוח") whitelists
-- them + pre-creates their profile so their next login just works.
-- ============================================================

create table public.access_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid default auth.uid(),   -- the denied (but authenticated) requester
  email         text not null,
  full_name     text,
  business_name text,
  phone         text,
  message       text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  handled_at    timestamptz,
  handled_by    uuid references public.profiles on delete set null
);
create index access_requests_status_idx on public.access_requests (status, created_at);

alter table public.access_requests enable row level security;

-- Any signed-in (even not-yet-whitelisted) user may file a request.
create policy access_requests_insert on public.access_requests
  for insert to authenticated with check (true);
-- A requester can read their OWN request (so the page can show "pending").
create policy access_requests_owner_select on public.access_requests
  for select to authenticated using (user_id = auth.uid());
-- Only the admin reads / manages them all.
create policy access_requests_admin_all on public.access_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- One-click approve: whitelist + pre-create the profile, mark handled.
create or replace function public.approve_access_request(p_id uuid, p_role text default 'client')
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text; v_biz text; v_phone text; v_uid uuid;
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  if p_role not in ('client', 'partner') then raise exception 'תפקיד לא תקין'; end if;

  select email, full_name, business_name, phone, user_id
    into v_email, v_name, v_biz, v_phone, v_uid
    from public.access_requests where id = p_id;
  if v_email is null then raise exception 'הבקשה לא נמצאה'; end if;

  insert into public.allowed_emails (email, role, full_name, business_name)
    values (lower(v_email), p_role, v_name, case when p_role = 'client' then v_biz end)
    on conflict (email) do update
      set role = excluded.role,
          full_name = coalesce(public.allowed_emails.full_name, excluded.full_name),
          business_name = coalesce(public.allowed_emails.business_name, excluded.business_name);

  -- If the requester already has an auth user (they logged in once), build their
  -- profile now so they don't have to wait for the next login to be set up.
  if v_uid is null then
    select id into v_uid from auth.users where lower(email) = lower(v_email) limit 1;
  end if;
  if v_uid is not null then
    insert into public.profiles (id, email, full_name, role, phone)
      values (v_uid, v_email, v_name, p_role, v_phone)
      on conflict (id) do update set phone = coalesce(public.profiles.phone, excluded.phone);
    if p_role = 'client' then
      insert into public.client_brand (client_id, business_name)
        values (v_uid, v_biz) on conflict (client_id) do nothing;
    elsif p_role = 'partner' then
      insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, referral_code)
        values (v_uid, 5.0, 5.0, 5.0, encode(extensions.gen_random_bytes(6), 'hex'))
        on conflict (id) do nothing;
    end if;
  end if;

  update public.access_requests
    set status = 'approved', handled_at = now(), handled_by = auth.uid()
    where id = p_id;
end;
$$;
revoke execute on function public.approve_access_request(uuid, text) from anon;
grant execute on function public.approve_access_request(uuid, text) to authenticated;

create or replace function public.reject_access_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  update public.access_requests
    set status = 'rejected', handled_at = now(), handled_by = auth.uid()
    where id = p_id;
end;
$$;
revoke execute on function public.reject_access_request(uuid) from anon;
grant execute on function public.reject_access_request(uuid) to authenticated;

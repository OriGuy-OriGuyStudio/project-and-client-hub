-- ============================================================
-- 0095 — service agreements (immutable approval snapshots)
-- ============================================================
-- The public /l/:token maintenance-packages landing lets a client approve a
-- plan. On approval we FREEZE exactly what they saw and agreed to (package,
-- price, and the full legal terms text) into service_agreements, so future
-- edits to the landing page or the terms never rewrite what was agreed.
--
-- Attribution rides on landing_invites: the admin generates a per-recipient
-- token from the client card (bound to a client_id + prefill). The public page
-- reads its prefill via get_landing_context() and the approval attaches to that
-- client via submit_service_agreement(). Both are SECURITY DEFINER and
-- anon-callable (the landing has no auth); the tables carry no anon insert
-- policy, only the definer RPCs write. The admin activates the service manually.
-- ============================================================

-- per-recipient landing link (admin-generated) -----------------------------
create table if not exists public.landing_invites (
  token       text primary key default replace(gen_random_uuid()::text, '-', ''),
  client_id   uuid references public.profiles(id) on delete set null,
  lead_name   text,
  business    text,
  email       text,
  phone       text,
  tier        text check (tier in ('core','pro','ultra')),
  site_type   text check (site_type in ('wordpress','custom')),
  gender      text check (gender in ('male','female')) default 'male',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.landing_invites enable row level security;
-- Admin manages links; the public page reads prefill only via the definer RPC.
create policy landing_invites_admin on public.landing_invites
  for all to authenticated using (is_admin()) with check (is_admin());

-- immutable approval snapshot ----------------------------------------------
create table if not exists public.service_agreements (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  access_token   text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invite_token   text references public.landing_invites(token) on delete set null,
  client_id      uuid references public.profiles(id) on delete set null,
  tier           text not null,
  site_type      text not null,
  monthly_price  numeric,
  response_hours int,
  work_hours     int,
  full_name      text,
  business       text,
  email          text,
  phone          text,
  signature      text,
  gender         text,
  terms_version  text not null,
  terms_snapshot jsonb not null,
  status         text not null default 'submitted' check (status in ('submitted','activated','cancelled')),
  updated_at     timestamptz not null default now()
);
alter table public.service_agreements enable row level security;
-- No insert policy: only submit_service_agreement() (definer) writes here.
create policy service_agreements_admin on public.service_agreements
  for all to authenticated using (is_admin()) with check (is_admin());
create policy service_agreements_client_read on public.service_agreements
  for select to authenticated using (client_id = auth.uid());

create index if not exists service_agreements_client_idx on public.service_agreements(client_id);

-- admin: generate a landing link -------------------------------------------
create or replace function public.create_landing_invite(
  p_client_id uuid  default null,
  p_lead_name text  default null,
  p_business  text  default null,
  p_email     text  default null,
  p_phone     text  default null,
  p_tier      text  default null,
  p_site_type text  default null,
  p_gender    text  default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  insert into public.landing_invites (client_id, lead_name, business, email, phone, tier, site_type, gender, created_by)
  values (
    p_client_id,
    nullif(left(coalesce(p_lead_name, ''), 120), ''),
    nullif(left(coalesce(p_business, ''), 160), ''),
    nullif(left(coalesce(p_email, ''), 160), ''),
    nullif(left(coalesce(p_phone, ''), 40), ''),
    case when p_tier in ('core','pro','ultra') then p_tier end,
    case when p_site_type in ('wordpress','custom') then p_site_type end,
    case when p_gender in ('male','female') then p_gender else 'male' end,
    auth.uid()
  )
  returning token into v_token;
  return v_token;
end $$;

-- public: read a landing link's prefill ------------------------------------
create or replace function public.get_landing_context(p_token text)
returns json
language sql security definer stable set search_path = public as $$
  select json_build_object(
    'token', li.token,
    'client_id', li.client_id,
    'name', coalesce(li.lead_name, p.full_name),
    'business', coalesce(li.business, cb.business_name),
    'email', coalesce(li.email, p.email),
    'phone', coalesce(li.phone, p.phone),
    'tier', li.tier,
    'site_type', li.site_type,
    'gender', li.gender
  )
  from public.landing_invites li
  left join public.profiles p on p.id = li.client_id
  left join public.client_brand cb on cb.client_id = li.client_id
  where li.token = p_token;
$$;

-- public: submit an approval (freezes the snapshot) ------------------------
create or replace function public.submit_service_agreement(p_token text, p_payload json)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_invite public.landing_invites;
  v_id     uuid;
  v_access text;
begin
  select * into v_invite from public.landing_invites where token = p_token;

  insert into public.service_agreements (
    invite_token, client_id, tier, site_type, monthly_price, response_hours, work_hours,
    full_name, business, email, phone, signature, gender, terms_version, terms_snapshot
  ) values (
    v_invite.token,              -- null when the token is unknown
    v_invite.client_id,
    coalesce(nullif(p_payload->>'tier', ''), 'pro'),
    coalesce(nullif(p_payload->>'site_type', ''), 'wordpress'),
    nullif(p_payload->>'monthly_price', '')::numeric,
    nullif(p_payload->>'response_hours', '')::int,
    nullif(p_payload->>'work_hours', '')::int,
    nullif(left(coalesce(p_payload->>'full_name', ''), 120), ''),
    nullif(left(coalesce(p_payload->>'business', ''), 160), ''),
    nullif(left(coalesce(p_payload->>'email', ''), 160), ''),
    nullif(left(coalesce(p_payload->>'phone', ''), 40), ''),
    nullif(left(coalesce(p_payload->>'signature', ''), 120), ''),
    case when p_payload->>'gender' in ('male','female') then p_payload->>'gender' else 'male' end,
    coalesce(nullif(p_payload->>'terms_version', ''), 'v1'),
    coalesce(p_payload->'terms_snapshot', '{}'::json)::jsonb
  )
  returning id, access_token into v_id, v_access;

  perform notify_admin(
    'service_agreement',
    'אישור חבילת שירות חדש',
    coalesce(v_invite.lead_name, nullif(p_payload->>'full_name', ''), 'לקוח')
      || ' אישר חבילת ' || coalesce(p_payload->>'tier', ''),
    case when v_invite.client_id is not null
         then '/admin/clients/' || v_invite.client_id::text
         else '/admin' end,
    null,
    v_id
  );

  return json_build_object('ok', true, 'id', v_id, 'access_token', v_access);
end $$;

-- public: read a submitted agreement (confirmation page) --------------------
create or replace function public.get_service_agreement(p_access_token text)
returns json
language sql security definer stable set search_path = public as $$
  select json_build_object(
    'id', sa.id,
    'created_at', sa.created_at,
    'tier', sa.tier,
    'site_type', sa.site_type,
    'monthly_price', sa.monthly_price,
    'response_hours', sa.response_hours,
    'work_hours', sa.work_hours,
    'full_name', sa.full_name,
    'business', sa.business,
    'email', sa.email,
    'phone', sa.phone,
    'signature', sa.signature,
    'gender', sa.gender,
    'terms_version', sa.terms_version,
    'terms_snapshot', sa.terms_snapshot,
    'status', sa.status
  )
  from public.service_agreements sa
  where sa.access_token = p_access_token;
$$;

grant execute on function public.get_landing_context(text) to anon, authenticated;
grant execute on function public.submit_service_agreement(text, json) to anon, authenticated;
grant execute on function public.get_service_agreement(text) to anon, authenticated;
grant execute on function public.create_landing_invite(uuid, text, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

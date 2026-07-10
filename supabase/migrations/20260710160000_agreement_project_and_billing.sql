-- ============================================================
-- 0097 — link agreements to a specific project + annual billing (15% off)
-- ============================================================
-- A client can have several projects, each with its own maintenance package, so
-- both the landing invite and the resulting agreement now carry a project_id.
-- The agreement also records the chosen billing cycle (monthly / annual); annual
-- gives a 15% discount, computed in the UI from monthly_price.
-- create_landing_invite gains p_project_id (dropped + recreated to change its
-- signature cleanly); the other RPCs are replaced in place.
-- ============================================================

alter table public.landing_invites
  add column if not exists project_id uuid references public.projects(id) on delete set null;

alter table public.service_agreements
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly','annual'));

-- admin: generate a landing link (now with an optional project) ------------
drop function if exists public.create_landing_invite(uuid, text, text, text, text, text, text, text);
create or replace function public.create_landing_invite(
  p_client_id  uuid default null,
  p_lead_name  text default null,
  p_business   text default null,
  p_email      text default null,
  p_phone      text default null,
  p_tier       text default null,
  p_site_type  text default null,
  p_gender     text default null,
  p_project_id uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  insert into public.landing_invites (client_id, project_id, lead_name, business, email, phone, tier, site_type, gender, created_by)
  values (
    p_client_id,
    p_project_id,
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

-- public: read a landing link's prefill (+ project) ------------------------
create or replace function public.get_landing_context(p_token text)
returns json
language sql security definer stable set search_path = public as $$
  select json_build_object(
    'token', li.token,
    'client_id', li.client_id,
    'project_id', li.project_id,
    'project_title', pr.title,
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
  left join public.projects pr on pr.id = li.project_id
  where li.token = p_token;
$$;

-- public: submit an approval (freezes snapshot, stores project + billing) ---
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
    invite_token, client_id, project_id, tier, site_type, monthly_price, response_hours, work_hours,
    billing_cycle, full_name, business, email, phone, signature, signature_image, gender,
    consent_accepted, consent_text, terms_version, terms_snapshot
  ) values (
    v_invite.token,
    v_invite.client_id,
    v_invite.project_id,
    coalesce(nullif(p_payload->>'tier', ''), 'pro'),
    coalesce(nullif(p_payload->>'site_type', ''), 'wordpress'),
    nullif(p_payload->>'monthly_price', '')::numeric,
    nullif(p_payload->>'response_hours', '')::int,
    nullif(p_payload->>'work_hours', '')::int,
    case when p_payload->>'billing_cycle' = 'annual' then 'annual' else 'monthly' end,
    nullif(left(coalesce(p_payload->>'full_name', ''), 120), ''),
    nullif(left(coalesce(p_payload->>'business', ''), 160), ''),
    nullif(left(coalesce(p_payload->>'email', ''), 160), ''),
    nullif(left(coalesce(p_payload->>'phone', ''), 40), ''),
    nullif(left(coalesce(p_payload->>'signature', ''), 120), ''),
    nullif(left(coalesce(p_payload->>'signature_image', ''), 300000), ''),
    case when p_payload->>'gender' in ('male','female') then p_payload->>'gender' else 'male' end,
    coalesce((p_payload->>'consent_accepted')::boolean, false),
    nullif(left(coalesce(p_payload->>'consent_text', ''), 400), ''),
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

-- public: read a submitted agreement (+ project + billing) ------------------
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
    'billing_cycle', sa.billing_cycle,
    'project_id', sa.project_id,
    'project_title', pr.title,
    'full_name', sa.full_name,
    'business', sa.business,
    'email', sa.email,
    'phone', sa.phone,
    'signature', sa.signature,
    'signature_image', sa.signature_image,
    'gender', sa.gender,
    'consent_accepted', sa.consent_accepted,
    'consent_text', sa.consent_text,
    'terms_version', sa.terms_version,
    'terms_snapshot', sa.terms_snapshot,
    'status', sa.status
  )
  from public.service_agreements sa
  left join public.projects pr on pr.id = sa.project_id
  where sa.access_token = p_access_token;
$$;

grant execute on function public.create_landing_invite(uuid, text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.get_landing_context(text) to anon, authenticated;
grant execute on function public.submit_service_agreement(text, json) to anon, authenticated;
grant execute on function public.get_service_agreement(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- 0096 — real signature + consent record on service agreements
-- ============================================================
-- Adds the drawn signature image, and an explicit record that the client ticked
-- the consent checkbox (+ the exact consent text they accepted). The signing
-- date & time is already created_at (timestamptz). submit_service_agreement and
-- get_service_agreement are updated to carry the new fields.
-- ============================================================

alter table public.service_agreements
  add column if not exists signature_image  text,
  add column if not exists consent_accepted  boolean not null default false,
  add column if not exists consent_text      text;

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
    full_name, business, email, phone, signature, signature_image, gender,
    consent_accepted, consent_text, terms_version, terms_snapshot
  ) values (
    v_invite.token,
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
    'signature_image', sa.signature_image,
    'gender', sa.gender,
    'consent_accepted', sa.consent_accepted,
    'consent_text', sa.consent_text,
    'terms_version', sa.terms_version,
    'terms_snapshot', sa.terms_snapshot,
    'status', sa.status
  )
  from public.service_agreements sa
  where sa.access_token = p_access_token;
$$;

grant execute on function public.submit_service_agreement(text, json) to anon, authenticated;
grant execute on function public.get_service_agreement(text) to anon, authenticated;

notify pgrst, 'reload schema';

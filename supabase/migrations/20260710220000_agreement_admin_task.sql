-- ============================================================
-- 0100 — create an admin task when a client approves a package
-- ============================================================
-- On every approval, besides the notification + email, drop a to-do on Ori's
-- admin task board ("open the package for the client"), which surfaces on the
-- main dashboard (AdminTasksPanel). Added inside submit_service_agreement (the
-- single definer write path); it can insert into admin_tasks despite its
-- admin-only RLS because the function is SECURITY DEFINER.
-- ============================================================

create or replace function public.submit_service_agreement(p_token text, p_payload json)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_invite public.landing_invites;
  v_id     uuid;
  v_access text;
  v_name   text;
  v_tier   text;
begin
  select * into v_invite from public.landing_invites where token = p_token;
  v_name := coalesce(v_invite.lead_name, nullif(p_payload->>'full_name', ''), 'לקוח');
  v_tier := coalesce(p_payload->'terms_snapshot'->>'tier_name', p_payload->>'tier', 'חבילה');

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

  -- to-do on the admin board (shows on the main dashboard)
  insert into public.admin_tasks (title, urgency, status, project_id, client_id)
  values ('לפתוח חבילת שירות: ' || v_name || ' · ' || v_tier, 'high', 'todo', v_invite.project_id, v_invite.client_id);

  perform notify_admin(
    'service_agreement',
    'אישור חבילת שירות חדש',
    v_name || ' אישר חבילת ' || coalesce(p_payload->>'tier', ''),
    case when v_invite.client_id is not null
         then '/admin/clients/' || v_invite.client_id::text
         else '/admin' end,
    null,
    v_id
  );

  return json_build_object('ok', true, 'id', v_id, 'access_token', v_access);
end $$;

grant execute on function public.submit_service_agreement(text, json) to anon, authenticated;

notify pgrst, 'reload schema';

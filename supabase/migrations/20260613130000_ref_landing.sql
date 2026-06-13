-- ============================================================
-- 0024 — Public referral landing (/ref/:code): tracking + lead capture RPCs
-- ============================================================
-- The landing page is reached by anonymous visitors via a partner's link. They
-- can't touch the RLS-protected tables directly, so three SECURITY DEFINER RPCs
-- (granted to anon) do the work: resolve the code → partner first name, record a
-- click, and submit a lead. A valid+active code attributes the lead to the
-- partner (partner_leads) and notifies the admin AND the partner; an invalid code
-- still captures the lead in a general inbox so nothing is lost.

-- ---- General inbound contacts (unattributed landing submissions) ------------
create table if not exists public.contact_submissions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  phone              text,
  email              text,
  project_type       text check (project_type in ('business_site','ecommerce','system','other')),
  message            text,
  ref_code_attempted text,
  created_at         timestamptz not null default now()
);
alter table public.contact_submissions enable row level security;
create policy "contact_submissions_admin_read" on public.contact_submissions
  for select to authenticated using (public.is_admin());
-- No insert policy: only the SECURITY DEFINER RPC below writes here.

-- ---- 1) Resolve a code → validity + the partner's FIRST name (nothing else) --
create or replace function public.resolve_referral(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_name text; v_active boolean;
begin
  select split_part(coalesce(pr.full_name, ''), ' ', 1), pp.is_active
    into v_name, v_active
  from public.partner_profiles pp
  join public.profiles pr on pr.id = pp.id
  where lower(pp.referral_code) = lower(trim(coalesce(p_code, '')));
  if v_name is null or v_active is not true then
    return json_build_object('valid', false);
  end if;
  return json_build_object('valid', true, 'partner_name', nullif(v_name, ''));
end; $$;

-- ---- 2) Record a click; returns the tracking id (to link a later conversion) -
create or replace function public.track_referral_click(p_code text, p_ua text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_partner uuid; v_id uuid;
begin
  select pp.id into v_partner from public.partner_profiles pp
  where lower(pp.referral_code) = lower(trim(coalesce(p_code, ''))) and pp.is_active;
  if v_partner is null then return null; end if;
  insert into public.referral_tracking (partner_id, referral_code, user_agent)
  values (v_partner, trim(p_code), left(coalesce(p_ua, ''), 400))
  returning id into v_id;
  return v_id;
end; $$;

-- ---- 3) Submit a lead from the landing --------------------------------------
create or replace function public.submit_referral_lead(
  p_code text, p_name text, p_phone text, p_email text,
  p_type text, p_message text, p_click_id uuid
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_partner uuid; v_lead uuid;
  v_name  text := left(trim(coalesce(p_name, '')), 160);
  v_phone text := left(trim(coalesce(p_phone, '')), 40);
  v_email text := left(trim(coalesce(p_email, '')), 160);
  v_msg   text := left(trim(coalesce(p_message, '')), 2000);
  v_type  text := case when p_type in ('business_site','ecommerce','system','other') then p_type else null end;
begin
  if v_name = '' or v_phone = '' then
    return json_build_object('ok', false, 'error', 'missing name/phone');
  end if;

  select pp.id into v_partner from public.partner_profiles pp
  where lower(pp.referral_code) = lower(trim(coalesce(p_code, ''))) and pp.is_active;

  if v_partner is null then
    insert into public.contact_submissions (name, phone, email, project_type, message, ref_code_attempted)
    values (v_name, nullif(v_phone, ''), nullif(v_email, ''), v_type, nullif(v_msg, ''),
            nullif(trim(coalesce(p_code, '')), ''));
    perform public.notify_admin('contact', 'פנייה חדשה מהאתר', v_name || ' · ' || v_phone, null, null, null);
    return json_build_object('ok', true, 'attributed', false);
  end if;

  insert into public.partner_leads (partner_id, lead_name, lead_phone, lead_email, project_type, notes, status)
  values (v_partner, v_name, nullif(v_phone, ''), nullif(v_email, ''), v_type, nullif(v_msg, ''), 'submitted')
  returning id into v_lead;

  if p_click_id is not null then
    update public.referral_tracking set converted_to_lead_id = v_lead
    where id = p_click_id and partner_id = v_partner;
  end if;

  perform public.notify_admin('partner_lead', 'ליד חדש מהלינק של שותף', v_name || ' · ' || v_phone,
                              '/admin/partners', null, v_lead);
  insert into public.notifications (audience, recipient_id, type, title, body, link)
  values ('client', v_partner, 'partner_lead', 'מישהו השאיר פרטים דרך הלינק שלך 🎉', v_name, '/partner-portal');

  return json_build_object('ok', true, 'attributed', true);
end; $$;

grant execute on function public.resolve_referral(text) to anon, authenticated;
grant execute on function public.track_referral_click(text, text) to anon, authenticated;
grant execute on function public.submit_referral_lead(text, text, text, text, text, text, uuid) to anon, authenticated;

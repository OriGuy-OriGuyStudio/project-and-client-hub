-- ============================================================
-- 0047 — Anti-spam / anti coin-farming for partner leads
-- Since a partner now earns +1 coin per submitted lead (0046), the form could be
-- spammed to farm coins. Enforce at the DB (covers EVERY insert path — landing
-- RPC, partner portal, direct API): a lead must have a valid contact (phone with
-- >=9 digits OR a valid email), and must not duplicate an existing lead of the
-- same partner (same normalized phone or email). Admins are exempt (retro deals).
-- ============================================================

create or replace function public.guard_partner_lead_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone_digits text := regexp_replace(coalesce(new.lead_phone, ''), '[^0-9]', '', 'g');
  v_email        text := lower(trim(coalesce(new.lead_email, '')));
begin
  -- The admin (Ori) is trusted: retro deals / manual fixes bypass the guards.
  if public.is_admin() then
    return new;
  end if;

  -- Must have a usable way to reach the lead.
  if char_length(v_phone_digits) < 9
     and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_contact' using errcode = 'check_violation';
  end if;

  -- No duplicate lead for the same partner (same phone digits or same email).
  if exists (
    select 1 from public.partner_leads pl
    where pl.partner_id = new.partner_id
      and pl.id <> new.id
      and (
        (char_length(v_phone_digits) >= 9
          and regexp_replace(coalesce(pl.lead_phone, ''), '[^0-9]', '', 'g') = v_phone_digits)
        or (v_email <> '' and lower(trim(coalesce(pl.lead_email, ''))) = v_email)
      )
  ) then
    raise exception 'duplicate_lead' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_partner_lead_insert on public.partner_leads;
-- Runs BEFORE the existing submit/closed reward triggers, so a blocked lead is
-- never created and never grants a coin.
create trigger guard_partner_lead_insert
  before insert on public.partner_leads
  for each row execute function public.guard_partner_lead_insert();

-- Landing RPC: validate + dedup up front and return a friendly result (so the
-- public form shows a message instead of a raw error). The guard above stays as
-- the hard backstop for any other path.
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
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if v_name = '' then
    return json_build_object('ok', false, 'error', 'missing');
  end if;

  -- Need a valid phone (>=9 digits) or a valid email.
  if char_length(v_phone_digits) < 9
     and lower(v_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return json_build_object('ok', false, 'error', 'invalid');
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

  -- Block a duplicate lead for this partner (anti coin-farming).
  if exists (
    select 1 from public.partner_leads pl
    where pl.partner_id = v_partner
      and (
        (char_length(v_phone_digits) >= 9
          and regexp_replace(coalesce(pl.lead_phone, ''), '[^0-9]', '', 'g') = v_phone_digits)
        or (v_email <> '' and lower(trim(coalesce(pl.lead_email, ''))) = lower(v_email))
      )
  ) then
    return json_build_object('ok', false, 'error', 'duplicate');
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

grant execute on function public.submit_referral_lead(text, text, text, text, text, text, uuid) to anon, authenticated;

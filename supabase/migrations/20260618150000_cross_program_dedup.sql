-- ============================================================
-- 0052 — Cross-program duplicate detection for leads/referrals
-- A contact was being blocked only within its own program (partner leads OR
-- client referrals). But the same prospect must not be submitted twice ANYWHERE:
-- a partner shouldn't be able to submit a lead a client already referred, and
-- vice versa, across all users. Add a shared `contact_already_submitted` check
-- (matches normalized phone OR email in BOTH tables) and use it in every guard.
-- Admins remain exempt.
-- ============================================================

create or replace function public.contact_already_submitted(p_phone text, p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.partner_leads pl
    where (public.il_phone_norm(p_phone) <> '' and public.il_phone_norm(pl.lead_phone) = public.il_phone_norm(p_phone))
       or (public.is_email_addr(p_email) and lower(trim(coalesce(pl.lead_email, ''))) = lower(trim(p_email)))
  ) or exists (
    select 1 from public.referrals r
    where (public.il_phone_norm(p_phone) <> '' and public.il_phone_norm(r.referred_contact) = public.il_phone_norm(p_phone))
       or (public.is_email_addr(p_email) and lower(trim(coalesce(r.referred_contact, ''))) = lower(trim(p_email)))
  );
$$;

-- partner leads: validate + cross-program duplicate block
create or replace function public.guard_partner_lead_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;

  if public.il_phone_norm(new.lead_phone) = '' and not public.is_email_addr(new.lead_email) then
    raise exception 'invalid_contact' using errcode = 'check_violation';
  end if;

  if public.contact_already_submitted(new.lead_phone, new.lead_email) then
    raise exception 'duplicate_lead' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

-- client referrals: validate + cross-program duplicate block (single contact field)
create or replace function public.guard_referral_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;

  if not public.is_valid_contact(new.referred_contact) then
    raise exception 'invalid_contact' using errcode = 'check_violation';
  end if;

  if public.contact_already_submitted(new.referred_contact, new.referred_contact) then
    raise exception 'duplicate_lead' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

-- landing RPC: friendly duplicate result, now cross-program
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
  if v_name = '' then
    return json_build_object('ok', false, 'error', 'missing');
  end if;
  if public.il_phone_norm(p_phone) = '' and not public.is_email_addr(v_email) then
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

  if public.contact_already_submitted(p_phone, v_email) then
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

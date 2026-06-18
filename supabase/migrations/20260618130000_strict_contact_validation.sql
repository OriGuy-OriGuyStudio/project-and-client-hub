-- ============================================================
-- 0050 — Strict Israeli contact validation (shared helpers)
-- The earlier guards accepted any phone with >=9 digits, so "05475208999" (11
-- digits) slipped through. Centralize real validation in helpers and use them in
-- every lead/referral guard so the DB matches the frontend exactly:
--   • mobile / 07x : 10 digits, 0(5X|7[2-9])XXXXXXX
--   • landline     : 9 digits,  0[2,3,4,8,9]XXXXXXX
--   • +972 accepted (normalized to local 0...), hyphens/spaces stripped
-- ============================================================

-- Normalize an Israeli phone to local 0XXXXXXXXX, or '' if not a valid IL number.
create or replace function public.il_phone_norm(p text)
returns text language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d ~ '^972' then d := '0' || substring(d from 4); end if;
  if d ~ '^0(5[0-9]|7[2-9])[0-9]{7}$' then return d; end if; -- mobile / 07x (10)
  if d ~ '^0[23489][0-9]{7}$' then return d; end if;          -- landline (9)
  return '';
end;
$$;

create or replace function public.is_email_addr(p text)
returns boolean language sql immutable set search_path = public as $$
  select lower(trim(coalesce(p, ''))) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
$$;

-- Valid contact = a valid IL phone OR a valid email.
create or replace function public.is_valid_contact(p text)
returns boolean language sql immutable set search_path = public as $$
  select public.il_phone_norm(p) <> '' or public.is_email_addr(p);
$$;

-- ---------- partner_leads: insert guard ----------
create or replace function public.guard_partner_lead_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_phone text := public.il_phone_norm(new.lead_phone);
begin
  if public.is_admin() then return new; end if;

  if v_phone = '' and not public.is_email_addr(new.lead_email) then
    raise exception 'invalid_contact' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.partner_leads pl
    where pl.partner_id = new.partner_id and pl.id <> new.id
      and (
        (v_phone <> '' and public.il_phone_norm(pl.lead_phone) = v_phone)
        or (public.is_email_addr(new.lead_email)
            and lower(trim(coalesce(pl.lead_email, ''))) = lower(trim(new.lead_email)))
      )
  ) then
    raise exception 'duplicate_lead' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

-- ---------- partner_leads: smart coin ----------
create or replace function public.partner_lead_submitted_reward()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name  text := lower(regexp_replace(trim(coalesce(new.lead_name, '')), '\s+', ' ', 'g'));
  v_phone text := public.il_phone_norm(new.lead_phone);
  v_email text := lower(trim(coalesce(new.lead_email, '')));
  v_recent int;
begin
  if exists (
    select 1 from public.partner_coin_transactions t
    join public.partner_leads pl on pl.id = t.lead_id
    where t.partner_id = new.partner_id and t.reason = 'lead_submitted'
      and (
        (v_name <> '' and lower(regexp_replace(trim(coalesce(pl.lead_name, '')), '\s+', ' ', 'g')) = v_name)
        or (v_phone <> '' and public.il_phone_norm(pl.lead_phone) = v_phone)
        or (public.is_email_addr(new.lead_email) and lower(trim(coalesce(pl.lead_email, ''))) = v_email)
      )
  ) then
    return new;
  end if;

  select count(*) into v_recent from public.partner_coin_transactions
   where partner_id = new.partner_id and reason = 'lead_submitted'
     and created_at > now() - interval '24 hours';
  if v_recent >= 5 then return new; end if;

  insert into public.partner_coin_transactions (partner_id, amount, reason, lead_id, note)
  values (new.partner_id, 1, 'lead_submitted', new.id, 'ליד הוגש');
  return new;
end;
$$;

-- ---------- referrals: insert guard ----------
create or replace function public.guard_referral_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_phone text := public.il_phone_norm(new.referred_contact);
begin
  if public.is_admin() then return new; end if;

  if not public.is_valid_contact(new.referred_contact) then
    raise exception 'invalid_contact' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.referrals r
    where r.referrer_id = new.referrer_id and r.id <> new.id
      and (
        (v_phone <> '' and public.il_phone_norm(r.referred_contact) = v_phone)
        or (public.is_email_addr(new.referred_contact)
            and lower(trim(coalesce(r.referred_contact, ''))) = lower(trim(new.referred_contact)))
      )
  ) then
    raise exception 'duplicate_lead' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

-- ---------- referrals: smart credit ----------
create or replace function public.grant_referral_credit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name  text := lower(regexp_replace(trim(coalesce(new.referred_name, '')), '\s+', ' ', 'g'));
  v_phone text := public.il_phone_norm(new.referred_contact);
  v_contact text := lower(trim(coalesce(new.referred_contact, '')));
  v_recent int;
begin
  if exists (
    select 1 from public.credit_transactions ct
    join public.referrals r on r.id = ct.referral_id
    where ct.client_id = new.referrer_id and ct.reason = 'referral_submitted'
      and (
        (v_name <> '' and lower(regexp_replace(trim(coalesce(r.referred_name, '')), '\s+', ' ', 'g')) = v_name)
        or (v_phone <> '' and public.il_phone_norm(r.referred_contact) = v_phone)
        or (public.is_email_addr(new.referred_contact) and lower(trim(coalesce(r.referred_contact, ''))) = v_contact)
      )
  ) then
    return new;
  end if;

  select count(*) into v_recent from public.credit_transactions
   where client_id = new.referrer_id and reason = 'referral_submitted'
     and created_at > now() - interval '24 hours';
  if v_recent >= 5 then return new; end if;

  insert into public.credit_transactions (client_id, amount, reason, referral_id, note)
  values (new.referrer_id, 1, 'referral_submitted', new.id, 'הפניה הוגשה');
  return new;
end;
$$;

-- ---------- landing RPC: strict validation + dedup ----------
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
  v_pnorm text := public.il_phone_norm(p_phone);
begin
  if v_name = '' then
    return json_build_object('ok', false, 'error', 'missing');
  end if;
  if v_pnorm = '' and not public.is_email_addr(v_email) then
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

  if exists (
    select 1 from public.partner_leads pl
    where pl.partner_id = v_partner
      and (
        (v_pnorm <> '' and public.il_phone_norm(pl.lead_phone) = v_pnorm)
        or (public.is_email_addr(v_email) and lower(trim(coalesce(pl.lead_email, ''))) = lower(v_email))
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

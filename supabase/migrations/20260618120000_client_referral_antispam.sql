-- ============================================================
-- 0049 — Anti-spam / anti credit-farming for CLIENT referrals
-- Mirror of the partner-lead guards (0047/0048) for the client referral program
-- (`referrals` table, +1 credit per submit via grant_referral_credit). A client
-- (e.g. שי רוזן) could spam the referral form with the same/junk contact and pile
-- up credits. Enforce a valid contact + no duplicates, and make the credit smart:
-- never pay twice for the same person, cap 5 credits per client per 24h. Admins
-- exempt. `referred_contact` is a single field (phone OR email).
-- ============================================================

-- Block invalid / duplicate referrals at insert (covers every path). Admins exempt.
create or replace function public.guard_referral_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_contact text := trim(coalesce(new.referred_contact, ''));
  v_digits  text := regexp_replace(coalesce(new.referred_contact, ''), '[^0-9]', '', 'g');
  v_is_email boolean := lower(v_contact) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
begin
  if public.is_admin() then
    return new;
  end if;

  if char_length(v_digits) < 9 and not v_is_email then
    raise exception 'invalid_contact' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.referrals r
    where r.referrer_id = new.referrer_id
      and r.id <> new.id
      and (
        (char_length(v_digits) >= 9
          and regexp_replace(coalesce(r.referred_contact, ''), '[^0-9]', '', 'g') = v_digits)
        or (v_is_email and lower(trim(coalesce(r.referred_contact, ''))) = lower(v_contact))
      )
  ) then
    raise exception 'duplicate_lead' using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_referral_insert on public.referrals;
create trigger guard_referral_insert
  before insert on public.referrals
  for each row execute function public.guard_referral_insert();

-- Smart credit: +1 on submit, but never twice for the same person and capped per day.
create or replace function public.grant_referral_credit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name    text := lower(regexp_replace(trim(coalesce(new.referred_name, '')), '\s+', ' ', 'g'));
  v_contact text := trim(coalesce(new.referred_contact, ''));
  v_digits  text := regexp_replace(coalesce(new.referred_contact, ''), '[^0-9]', '', 'g');
  v_recent  int;
begin
  -- Already credited this person? (same referrer, same name or same contact)
  if exists (
    select 1
    from public.credit_transactions ct
    join public.referrals r on r.id = ct.referral_id
    where ct.client_id = new.referrer_id
      and ct.reason = 'referral_submitted'
      and (
        (v_name <> '' and lower(regexp_replace(trim(coalesce(r.referred_name, '')), '\s+', ' ', 'g')) = v_name)
        or (char_length(v_digits) >= 9
            and regexp_replace(coalesce(r.referred_contact, ''), '[^0-9]', '', 'g') = v_digits)
        or (v_contact <> '' and lower(trim(coalesce(r.referred_contact, ''))) = lower(v_contact))
      )
  ) then
    return new; -- no second credit for the same person
  end if;

  -- Daily cap: at most 5 referral credits per client per rolling 24h.
  select count(*) into v_recent
  from public.credit_transactions
  where client_id = new.referrer_id
    and reason = 'referral_submitted'
    and created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    return new; -- capped; the referral is kept, the credit withheld
  end if;

  insert into public.credit_transactions (client_id, amount, reason, referral_id, note)
  values (new.referrer_id, 1, 'referral_submitted', new.id, 'הפניה הוגשה');
  return new;
end;
$$;

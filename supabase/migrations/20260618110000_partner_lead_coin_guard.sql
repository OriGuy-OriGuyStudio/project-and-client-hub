-- ============================================================
-- 0048 — Harden the lead-submission coin against farming
-- The +1 coin-on-submit (0046) is farmable by submitting the same person with a
-- different phone each time, or by bulk-spamming distinct fake leads. Keep the
-- coin-on-submit model (parity with clients) but make the COIN grant smart:
--   (a) never pay twice for the same person (same partner + same name/phone/email),
--   (b) cap at 5 lead-coins per partner per rolling 24h.
-- The lead row is still created (subject to the 0047 valid-contact + duplicate
-- guards); only the coin is withheld. Admins are unaffected (they don't earn).
-- ============================================================

create or replace function public.partner_lead_submitted_reward()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name         text := lower(regexp_replace(trim(coalesce(new.lead_name, '')), '\s+', ' ', 'g'));
  v_phone_digits text := regexp_replace(coalesce(new.lead_phone, ''), '[^0-9]', '', 'g');
  v_email        text := lower(trim(coalesce(new.lead_email, '')));
  v_recent       int;
begin
  -- (a) Already rewarded for this person? (same partner, same name/phone/email)
  if exists (
    select 1
    from public.partner_coin_transactions t
    join public.partner_leads pl on pl.id = t.lead_id
    where t.partner_id = new.partner_id
      and t.reason = 'lead_submitted'
      and (
        (v_name <> '' and lower(regexp_replace(trim(coalesce(pl.lead_name, '')), '\s+', ' ', 'g')) = v_name)
        or (char_length(v_phone_digits) >= 9
            and regexp_replace(coalesce(pl.lead_phone, ''), '[^0-9]', '', 'g') = v_phone_digits)
        or (v_email <> '' and lower(trim(coalesce(pl.lead_email, ''))) = v_email)
      )
  ) then
    return new; -- no second coin for the same lead/person
  end if;

  -- (b) Daily cap: at most 5 lead coins per partner per rolling 24h.
  select count(*) into v_recent
  from public.partner_coin_transactions
  where partner_id = new.partner_id
    and reason = 'lead_submitted'
    and created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    return new; -- capped; the lead is kept, the coin is withheld
  end if;

  insert into public.partner_coin_transactions (partner_id, amount, reason, lead_id, note)
  values (new.partner_id, 1, 'lead_submitted', new.id, 'ליד הוגש');
  return new;
end;
$$;

-- ============================================================
-- 0045 — Easter-egg reward for PARTNERS too
-- The "warp" easter egg (clicking the Orion footer wordmark) only rewarded
-- CLIENTS (5 credits + the "curious" badge); a partner who found it got the
-- animation but no reward. Extend it: a partner now earns 5 COINS + the same
-- one-time "curious" badge, on the partner coin ledger.
-- ============================================================

-- Allow the new ledger reason on partner coins.
alter table public.partner_coin_transactions drop constraint partner_coin_transactions_reason_check;
alter table public.partner_coin_transactions add constraint partner_coin_transactions_reason_check
  check (reason in ('deal_closed','reward_redeemed','manual_adjustment','gift','compensation','easter_egg'));

-- Claim the bonus, ONCE per user (the easter_egg_claims PK on profiles.id is the
-- badge marker for clients AND partners). Clients get 5 credits; partners get 5
-- coins. Anyone else is not eligible.
create or replace function public.claim_easter_egg()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_enrolled boolean;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  v_role := public.get_my_role();
  if v_role not in ('client', 'partner') then
    return json_build_object('granted', false, 'reason', 'not_eligible');
  end if;
  if exists (select 1 from public.easter_egg_claims where client_id = v_uid) then
    return json_build_object('granted', false, 'already', true);
  end if;
  insert into public.easter_egg_claims (client_id) values (v_uid);

  if v_role = 'partner' then
    insert into public.partner_coin_transactions (partner_id, amount, reason, note)
      values (v_uid, 5, 'easter_egg', 'גילית את ההפתעה הנסתרת, תג סקרן 🔭');
    -- A partner is always "enrolled" (it's their own program), so the popup
    -- skips the client-only "saved until you enrol" note.
    return json_build_object('granted', true, 'coins', 5, 'enrolled', true);
  end if;

  -- client
  insert into public.credit_transactions (client_id, amount, reason, note)
    values (v_uid, 5, 'easter_egg', 'גילית את ההפתעה הנסתרת, תג סקרן 🔭');
  v_enrolled := exists (select 1 from public.partner_enrollments where client_id = v_uid);
  return json_build_object('granted', true, 'coins', 5, 'enrolled', v_enrolled);
end;
$$;
revoke execute on function public.claim_easter_egg() from anon;
grant execute on function public.claim_easter_egg() to authenticated;

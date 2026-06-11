-- ============================================================
-- 0010 — Client partner program: auto-credit on referral + redeem RPC
-- ============================================================

-- +1 credit immediately when a client submits a referral.
create or replace function public.grant_referral_credit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.credit_transactions (client_id, amount, reason, referral_id, note)
  values (new.referrer_id, 1, 'referral_submitted', new.id, 'הפניה הוגשה');
  return new;
end;
$$;
create trigger referrals_grant_credit
  after insert on public.referrals
  for each row execute function public.grant_referral_credit();

-- Atomic reward redemption (balance check + redemption + negative ledger entry).
create or replace function public.redeem_reward(p_reward_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cost int;
  v_active boolean;
  v_balance int;
  v_redemption_id uuid;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  select credit_cost, is_active into v_cost, v_active from public.rewards where id = p_reward_id;
  if v_cost is null or not v_active then raise exception 'הפרס אינו זמין'; end if;
  v_balance := public.get_client_credits(v_uid);
  if v_balance < v_cost then raise exception 'אין מספיק קרדיטים'; end if;
  insert into public.reward_redemptions (client_id, reward_id, credits_spent, status)
  values (v_uid, p_reward_id, v_cost, 'pending') returning id into v_redemption_id;
  insert into public.credit_transactions (client_id, amount, reason, note)
  values (v_uid, -v_cost, 'reward_redeemed', 'מימוש פרס');
  return v_redemption_id;
end;
$$;
revoke execute on function public.redeem_reward(uuid) from anon;
grant execute on function public.redeem_reward(uuid) to authenticated;

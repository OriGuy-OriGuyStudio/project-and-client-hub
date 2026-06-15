-- ============================================================
-- 0038 — "Both" audience + monetary gift value
-- (a) A reward can target client + partner at once (audience='both'),
--     shown in both stores at the same coin cost.
-- (b) A reward can be flagged "monetary": the store shows a derived ₪
--     value = round(cost × ils_per_coin × gift_value_pct/100), so it
--     auto-updates when the coin rate changes.
-- ============================================================

alter table public.rewards drop constraint if exists rewards_audience_check;
alter table public.rewards
  add constraint rewards_audience_check check (audience in ('client', 'partner', 'both'));

alter table public.rewards
  add column if not exists is_monetary boolean not null default false;

alter table public.studio_settings
  add column if not exists gift_value_pct numeric(5,2) not null default 75
    check (gift_value_pct > 0);
comment on column public.studio_settings.gift_value_pct is
  'Percent of full coin value shown as a monetary reward''s ₪ value.';

-- Stock counts: a reward''s total non-cancelled redemptions across BOTH
-- ledgers (so a "both" reward shares one global stock). Include both/audience.
create or replace function public.rewards_stock_used(p_audience text)
returns table (reward_id uuid, used int)
language sql security definer set search_path = public stable as $$
  select r.id, (
    (select count(*) from public.reward_redemptions x
       where x.reward_id = r.id and x.status <> 'cancelled')
    + (select count(*) from public.partner_reward_redemptions y
       where y.reward_id = r.id and y.status <> 'cancelled')
  )::int
  from public.rewards r
  where r.audience = p_audience or r.audience = 'both';
$$;
revoke execute on function public.rewards_stock_used(text) from anon;
grant execute on function public.rewards_stock_used(text) to authenticated;

-- Purchasable guard: sum both ledgers (covers client / partner / both).
create or replace function public.assert_reward_purchasable(p_reward_id uuid, p_partner boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_until timestamptz; v_stock int; v_used int;
begin
  select available_from, available_until, stock
    into v_from, v_until, v_stock
    from public.rewards where id = p_reward_id;
  if v_from is not null and now() < v_from then raise exception 'הפרס עדיין לא זמין'; end if;
  if v_until is not null and now() > v_until then raise exception 'הפרס כבר לא זמין'; end if;
  if v_stock is not null then
    select (
      (select count(*) from public.reward_redemptions
         where reward_id = p_reward_id and status <> 'cancelled')
      + (select count(*) from public.partner_reward_redemptions
         where reward_id = p_reward_id and status <> 'cancelled')
    ) into v_used;
    if v_used >= v_stock then raise exception 'הפרס אזל מהמלאי'; end if;
  end if;
end;
$$;

-- Allow 'both' rewards through each redeem RPC.
create or replace function public.redeem_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_cost int; v_active boolean; v_aud text;
  v_balance int; v_redemption_id uuid;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  select credit_cost, is_active, audience into v_cost, v_active, v_aud
    from public.rewards where id = p_reward_id;
  if v_cost is null or not v_active or v_aud not in ('client', 'both') then
    raise exception 'הפרס אינו זמין';
  end if;
  perform public.assert_reward_purchasable(p_reward_id, false);
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

create or replace function public.redeem_partner_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost int; v_active boolean; v_aud text; v_kind text; v_bal int; v_red uuid;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  select credit_cost, is_active, audience, kind
    into v_cost, v_active, v_aud, v_kind
    from public.rewards where id = p_reward_id;
  if v_cost is null then raise exception 'הפרס לא נמצא'; end if;
  if not v_active or v_aud not in ('partner', 'both') then raise exception 'הפרס לא זמין'; end if;
  perform public.assert_reward_purchasable(p_reward_id, true);
  v_bal := public.get_partner_coins(v_uid);
  if v_bal < v_cost then raise exception 'אין מספיק מטבעות'; end if;

  insert into public.partner_reward_redemptions (partner_id, reward_id, coins_spent, status)
    values (v_uid, p_reward_id, v_cost, 'pending') returning id into v_red;
  insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (v_uid, -v_cost, 'reward_redeemed', 'מימוש פרס בחנות');

  if v_kind = 'commission_boost' then
    update public.partner_profiles set boost_pct = 2, boost_deals_left = 3 where id = v_uid;
  end if;
  return v_red;
end;
$$;
revoke execute on function public.redeem_partner_reward(uuid) from anon;
grant execute on function public.redeem_partner_reward(uuid) to authenticated;

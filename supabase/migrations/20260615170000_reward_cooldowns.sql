-- ============================================================
-- 0034 — Stop re-buying a reward while it's pending / active, and a
-- per-reward repeat policy (cooldown_days): null = one-time,
-- 0 = repeatable once handled, N = available again N days after fulfilment.
-- Enforced server-side in the redeem RPCs + surfaced in the UI.
-- ============================================================

alter table public.rewards add column if not exists cooldown_days int default 0;

-- per-reward policy
update public.rewards set cooldown_days = null where name = 'גישה לפיקסל (ה-AI)';            -- one-time
update public.rewards set cooldown_days = 30   where name = 'פוסט שיתופי + קישור לאתר שלך';   -- monthly-ish
update public.rewards set cooldown_days = 30   where name = 'Studio Pro חודש חינם';
update public.rewards set cooldown_days = 0    where name in ('שובר מתנה ₪100','תרומה לצדקה בשמך','המרה לתשלום','בוסט עמלה +2%');

-- ---- partner redeem with re-purchase guards ----
create or replace function public.redeem_partner_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost int; v_active boolean; v_aud text; v_kind text; v_bal int; v_red uuid; v_cd int;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  select credit_cost, is_active, audience, kind, cooldown_days
    into v_cost, v_active, v_aud, v_kind, v_cd
    from public.rewards where id = p_reward_id;
  if v_cost is null then raise exception 'הפרס לא נמצא'; end if;
  if not v_active or v_aud <> 'partner' then raise exception 'הפרס לא זמין'; end if;

  -- can't buy again while one is awaiting approval
  if exists (select 1 from public.partner_reward_redemptions
             where partner_id = v_uid and reward_id = p_reward_id and status = 'pending') then
    raise exception 'כבר מימשת את הפרס הזה, והוא ממתין לאישור';
  end if;

  if v_kind = 'commission_boost' then
    if coalesce((select boost_deals_left from public.partner_profiles where id = v_uid), 0) > 0 then
      raise exception 'הבוסט כבר פעיל';
    end if;
  elsif v_cd is null then
    if exists (select 1 from public.partner_reward_redemptions
               where partner_id = v_uid and reward_id = p_reward_id and status = 'fulfilled') then
      raise exception 'הפרס הזה חד-פעמי וכבר מומש';
    end if;
  elsif v_cd > 0 then
    if exists (select 1 from public.partner_reward_redemptions
               where partner_id = v_uid and reward_id = p_reward_id and status = 'fulfilled'
                 and fulfilled_at > now() - (v_cd || ' days')::interval) then
      raise exception 'הפרס הזה יהיה זמין שוב בקרוב';
    end if;
  end if;

  v_bal := public.get_partner_coins(v_uid);
  if v_bal < v_cost then raise exception 'אין מספיק מטבעות'; end if;

  if v_kind = 'commission_boost' then
    insert into public.partner_reward_redemptions (partner_id, reward_id, coins_spent, status, fulfilled_at)
      values (v_uid, p_reward_id, v_cost, 'fulfilled', now()) returning id into v_red;
    update public.partner_profiles set boost_pct = 2, boost_deals_left = 3 where id = v_uid;
  else
    insert into public.partner_reward_redemptions (partner_id, reward_id, coins_spent, status)
      values (v_uid, p_reward_id, v_cost, 'pending') returning id into v_red;
  end if;

  insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (v_uid, -v_cost, 'reward_redeemed', 'מימוש פרס בחנות');
  return v_red;
end;
$$;
revoke execute on function public.redeem_partner_reward(uuid) from anon;

-- ---- client redeem with re-purchase guards ----
create or replace function public.redeem_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost int; v_active boolean; v_aud text; v_cd int; v_balance int; v_redemption_id uuid;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  select credit_cost, is_active, audience, cooldown_days
    into v_cost, v_active, v_aud, v_cd
    from public.rewards where id = p_reward_id;
  if v_cost is null or not v_active or v_aud <> 'client' then raise exception 'הפרס אינו זמין'; end if;

  if exists (select 1 from public.reward_redemptions
             where client_id = v_uid and reward_id = p_reward_id and status = 'pending') then
    raise exception 'כבר מימשת את הפרס הזה, והוא ממתין לאישור';
  end if;
  if v_cd is null then
    if exists (select 1 from public.reward_redemptions
               where client_id = v_uid and reward_id = p_reward_id and status = 'fulfilled') then
      raise exception 'הפרס הזה חד-פעמי וכבר מומש';
    end if;
  elsif v_cd > 0 then
    if exists (select 1 from public.reward_redemptions
               where client_id = v_uid and reward_id = p_reward_id and status = 'fulfilled'
                 and fulfilled_at > now() - (v_cd || ' days')::interval) then
      raise exception 'הפרס הזה יהיה זמין שוב בקרוב';
    end if;
  end if;

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

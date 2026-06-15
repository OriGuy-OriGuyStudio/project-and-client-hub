-- ============================================================
-- 0033 — Commission-boost redemptions are applied instantly, so mark
-- them 'fulfilled' on redeem (they don't need an admin action and
-- shouldn't show up as "pending" to the partner).
-- ============================================================

create or replace function public.redeem_partner_reward(p_reward_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cost int; v_active boolean; v_aud text; v_kind text; v_bal int; v_red uuid;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  select credit_cost, is_active, audience, kind
    into v_cost, v_active, v_aud, v_kind
    from public.rewards where id = p_reward_id;
  if v_cost is null then raise exception 'הפרס לא נמצא'; end if;
  if not v_active or v_aud <> 'partner' then raise exception 'הפרס לא זמין'; end if;
  v_bal := public.get_partner_coins(v_uid);
  if v_bal < v_cost then raise exception 'אין מספיק מטבעות'; end if;

  if v_kind = 'commission_boost' then
    -- applied immediately, no admin step
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

-- ============================================================
-- 0027 — Partner store + payout + commission boost (chunk 2)
-- Builds on 0026 (partner coins + tiers). Partners spend coins in
-- a store; redemptions are admin-fulfilled. A "+2% for 3 closed
-- deals" boost auto-decrements on each close.
-- ============================================================

-- 1. rewards gains an audience (client | partner) + a kind for special handling
alter table public.rewards
  add column if not exists audience text not null default 'client'
    check (audience in ('client','partner')),
  add column if not exists kind text not null default 'generic'
    check (kind in ('generic','payout','commission_boost'));

-- 2. partner redemptions ledger (admin-fulfilled)
create table if not exists public.partner_reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.profiles(id) on delete cascade,
  reward_id    uuid not null references public.rewards(id),
  coins_spent  int not null,
  status       text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  note         text,
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz
);
create index if not exists partner_redemptions_partner_idx on public.partner_reward_redemptions (partner_id);

alter table public.partner_reward_redemptions enable row level security;
drop policy if exists partner_redemptions_select on public.partner_reward_redemptions;
create policy partner_redemptions_select on public.partner_reward_redemptions
  for select to authenticated using (partner_id = auth.uid() or public.is_admin());
drop policy if exists partner_redemptions_admin_all on public.partner_reward_redemptions;
create policy partner_redemptions_admin_all on public.partner_reward_redemptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. active commission boost on the partner profile
alter table public.partner_profiles
  add column if not exists boost_pct        numeric(5,2) not null default 0,
  add column if not exists boost_deals_left int          not null default 0;

-- 4. atomic redeem: balance check + redemption + negative ledger entry (+ boost)
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

-- 5. extend the close trigger to also decrement an active boost
create or replace function public.partner_lead_closed_rewards()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then
    if not exists (
      select 1 from public.partner_coin_transactions
      where lead_id = new.id and reason = 'deal_closed'
    ) then
      insert into public.partner_coin_transactions (partner_id, amount, reason, lead_id, note)
      values (new.partner_id, 20, 'deal_closed', new.id, 'עסקה נסגרה');
    end if;
    perform public.recompute_partner_tier(new.partner_id);
    -- decrement an active commission boost; clear it when it runs out
    update public.partner_profiles
      set boost_deals_left = greatest(boost_deals_left - 1, 0),
          boost_pct = case when boost_deals_left - 1 <= 0 then 0 else boost_pct end
      where id = new.partner_id and boost_deals_left > 0;
  elsif old.status = 'closed' and new.status is distinct from 'closed' then
    delete from public.partner_coin_transactions
      where lead_id = new.id and reason = 'deal_closed';
    perform public.recompute_partner_tier(new.partner_id);
  end if;
  return new;
end;
$$;

-- 6. seed the partner store (once)
do $$
begin
  if not exists (select 1 from public.rewards where audience = 'partner') then
    insert into public.rewards (name, description, credit_cost, reward_type, is_active, audience, kind) values
      ('בוסט עמלה +2%', 'תוספת של 2% לעמלה ל-3 העסקאות הבאות שייסגרו. מתבטל אוטומטית אחריהן.', 60, 'custom', true, 'partner', 'commission_boost'),
      ('המרה לתשלום', 'המרת מטבעות לתשלום במזומן (בכפוף לאישור). 100 מטבעות = ₪50.', 100, 'custom', true, 'partner', 'payout'),
      ('שובר מתנה ₪100', 'שובר מתנה לרשת לבחירתך.', 120, 'custom', true, 'partner', 'generic'),
      ('פוסט שיתופי + קישור לאתר שלך', 'פוסט/סטורי משותף בערוצים של הסטודיו וקישור (dofollow) לאתר שלך. חשיפה ו-SEO.', 150, 'custom', true, 'partner', 'generic'),
      ('גישה לפיקסל (ה-AI)', 'גישה ל-Pixel, עוזר ה-AI של הסטודיו.', 120, 'custom', true, 'partner', 'generic'),
      ('תרומה לצדקה בשמך', 'נתרום לעמותה לבחירתך, בשמך.', 80, 'custom', true, 'partner', 'generic');
  end if;
end $$;

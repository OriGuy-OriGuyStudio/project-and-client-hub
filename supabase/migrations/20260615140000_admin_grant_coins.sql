-- ============================================================
-- 0031 — Admin grants gift / compensation coins (client or partner)
-- Adds 'gift'/'compensation' ledger reasons, lets notifications target
-- partners, and a grant_coins() RPC that credits the right ledger and
-- drops a notification so the portal can pop a celebratory message.
-- ============================================================

-- 1. new ledger reasons on both currencies
alter table public.credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table public.credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('referral_submitted','deal_closed','reward_redeemed','manual_adjustment','easter_egg','gift','compensation'));

alter table public.partner_coin_transactions drop constraint if exists partner_coin_transactions_reason_check;
alter table public.partner_coin_transactions add constraint partner_coin_transactions_reason_check
  check (reason in ('deal_closed','reward_redeemed','manual_adjustment','gift','compensation'));

-- 2. notifications can target a partner
alter table public.notifications drop constraint if exists notifications_audience_check;
alter table public.notifications add constraint notifications_audience_check
  check (audience in ('admin','client','partner'));

-- 3. grant gift/compensation coins to a client or partner
create or replace function public.grant_coins(
  p_user uuid, p_amount int, p_kind text, p_reason text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_title text; v_link text;
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'סכום לא תקין'; end if;
  if p_kind not in ('gift','compensation') then raise exception 'סוג לא תקין'; end if;

  select role into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'משתמש לא נמצא'; end if;

  if v_role = 'partner' then
    insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (p_user, p_amount, p_kind, p_reason);
    v_link := '/partner-portal';
  elsif v_role = 'client' then
    insert into public.credit_transactions (client_id, amount, reason, note, created_by)
    values (p_user, p_amount, p_kind, p_reason, auth.uid());
    v_link := '/partner';
  else
    raise exception 'אפשר להעניק מטבעות ללקוח או לשותף בלבד';
  end if;

  v_title := case when p_kind = 'gift' then '🎁 קיבלת מתנה!' else '💛 קיבלת פיצוי במטבעות' end;
  insert into public.notifications (audience, recipient_id, type, title, body, link)
  values (
    v_role, p_user, p_kind, v_title,
    case
      when p_kind = 'gift' then 'אורי שלח לך ' || p_amount || ' מטבעות מתנה' || coalesce(' · ' || p_reason, '') || '. ממתינות לך בממשק!'
      else 'זוכית ב-' || p_amount || ' מטבעות כפיצוי' || coalesce(' · ' || p_reason, '') || '. ממתינות לך בממשק.'
    end,
    v_link
  );
end;
$$;
revoke execute on function public.grant_coins(uuid, int, text, text) from anon;

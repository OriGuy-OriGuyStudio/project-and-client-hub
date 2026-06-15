-- ============================================================
-- 0032 — Gift/compensation audit trail + client redemption admin +
--        "redemption approved" celebration notifications
-- ============================================================

-- 1. audit table: one row per gift/compensation grant
create table if not exists public.coin_grants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            text check (kind in ('gift','compensation')),
  amount          int not null,
  reason          text,
  granted_by      uuid references public.profiles(id),
  email_status    text not null default 'pending' check (email_status in ('pending','sent','failed')),
  notification_id uuid references public.notifications(id) on delete set null,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz
);
create index if not exists coin_grants_user_idx on public.coin_grants (user_id);

alter table public.coin_grants enable row level security;
drop policy if exists coin_grants_admin_all on public.coin_grants;
create policy coin_grants_admin_all on public.coin_grants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists coin_grants_select_own on public.coin_grants;
create policy coin_grants_select_own on public.coin_grants
  for select to authenticated using (user_id = auth.uid());

-- 2. allow cancelling a client reward redemption
alter table public.reward_redemptions drop constraint if exists reward_redemptions_status_check;
alter table public.reward_redemptions add constraint reward_redemptions_status_check
  check (status in ('pending','fulfilled','cancelled'));

-- 3. grant_coins v2 — also writes the audit row + links the notification
drop function if exists public.grant_coins(uuid, int, text, text);
create or replace function public.grant_coins(
  p_user uuid, p_amount int, p_kind text, p_reason text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_role text; v_title text; v_link text; v_notif uuid; v_grant uuid;
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
  ) returning id into v_notif;

  insert into public.coin_grants (user_id, kind, amount, reason, granted_by, notification_id)
  values (p_user, p_kind, p_amount, p_reason, auth.uid(), v_notif)
  returning id into v_grant;

  return v_grant;
end;
$$;
revoke execute on function public.grant_coins(uuid, int, text, text) from anon;

-- 4. edge fn marks whether the email went out
create or replace function public.mark_coin_grant_emailed(p_grant_id uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  update public.coin_grants set email_status = case when p_ok then 'sent' else 'failed' end
    where id = p_grant_id;
end;
$$;
revoke execute on function public.mark_coin_grant_emailed(uuid, boolean) from anon;

-- 5. recipient acknowledges a grant (from the celebratory popup)
create or replace function public.acknowledge_coin_grant(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.coin_grants
    set acknowledged_at = coalesce(acknowledged_at, now())
    where notification_id = p_notification_id and user_id = auth.uid();
  update public.notifications set is_read = true
    where id = p_notification_id and recipient_id = auth.uid();
end;
$$;
revoke execute on function public.acknowledge_coin_grant(uuid) from anon;

-- 6. partner redemption status now also celebrates the partner on fulfil
create or replace function public.set_partner_redemption_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_partner uuid; v_coins int; v_name text;
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  if p_status not in ('fulfilled','cancelled','pending') then raise exception 'סטטוס לא תקין'; end if;

  select r.status, r.partner_id, r.coins_spent, rw.name
    into v_status, v_partner, v_coins, v_name
    from public.partner_reward_redemptions r
    left join public.rewards rw on rw.id = r.reward_id
    where r.id = p_id;
  if v_status is null then raise exception 'המימוש לא נמצא'; end if;
  if p_status = v_status then return; end if;

  if p_status = 'cancelled' and v_status <> 'cancelled' then
    insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (v_partner, v_coins, 'manual_adjustment', 'החזר על ביטול מימוש');
  end if;
  if v_status = 'cancelled' and p_status <> 'cancelled' then
    insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (v_partner, -v_coins, 'manual_adjustment', 'חיוב מחדש על מימוש');
  end if;

  update public.partner_reward_redemptions
    set status = p_status, fulfilled_at = case when p_status = 'fulfilled' then now() else null end
    where id = p_id;

  if p_status = 'fulfilled' then
    insert into public.notifications (audience, recipient_id, type, title, body, link)
    values ('partner', v_partner, 'redemption_fulfilled', '🎉 המימוש שלך אושר!',
            coalesce(v_name, 'הפרס') || ' מוכן. תודה!', '/partner-portal');
  end if;
end;
$$;

-- 7. client redemption status (admin): mirror of partner, refunds credits on cancel
create or replace function public.set_client_redemption_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_client uuid; v_cost int; v_name text;
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  if p_status not in ('fulfilled','cancelled','pending') then raise exception 'סטטוס לא תקין'; end if;

  select r.status, r.client_id, r.credits_spent, rw.name
    into v_status, v_client, v_cost, v_name
    from public.reward_redemptions r
    left join public.rewards rw on rw.id = r.reward_id
    where r.id = p_id;
  if v_status is null then raise exception 'המימוש לא נמצא'; end if;
  if p_status = v_status then return; end if;

  if p_status = 'cancelled' and v_status <> 'cancelled' then
    insert into public.credit_transactions (client_id, amount, reason, note)
    values (v_client, v_cost, 'manual_adjustment', 'החזר על ביטול מימוש');
  end if;
  if v_status = 'cancelled' and p_status <> 'cancelled' then
    insert into public.credit_transactions (client_id, amount, reason, note)
    values (v_client, -v_cost, 'manual_adjustment', 'חיוב מחדש על מימוש');
  end if;

  update public.reward_redemptions
    set status = p_status, fulfilled_at = case when p_status = 'fulfilled' then now() else null end
    where id = p_id;

  if p_status = 'fulfilled' then
    insert into public.notifications (audience, recipient_id, type, title, body, link)
    values ('client', v_client, 'redemption_fulfilled', '🎉 המימוש שלך אושר!',
            coalesce(v_name, 'הפרס') || ' מוכן. תודה!', '/partner');
  end if;
end;
$$;
revoke execute on function public.set_client_redemption_status(uuid, text) from anon;

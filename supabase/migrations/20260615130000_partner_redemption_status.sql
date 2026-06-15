-- ============================================================
-- 0030 — Admin fulfils / cancels partner redemptions
-- Cancelling refunds the coins; un-cancelling re-charges them.
-- Admin-only, server-side (SECURITY DEFINER).
-- ============================================================

create or replace function public.set_partner_redemption_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_partner uuid; v_coins int;
begin
  if not public.is_admin() then raise exception 'אין הרשאה'; end if;
  if p_status not in ('fulfilled','cancelled','pending') then raise exception 'סטטוס לא תקין'; end if;

  select status, partner_id, coins_spent into v_status, v_partner, v_coins
    from public.partner_reward_redemptions where id = p_id;
  if v_status is null then raise exception 'המימוש לא נמצא'; end if;
  if p_status = v_status then return; end if;

  -- refund coins when cancelling a previously-active redemption
  if p_status = 'cancelled' and v_status <> 'cancelled' then
    insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (v_partner, v_coins, 'manual_adjustment', 'החזר על ביטול מימוש');
  end if;
  -- re-charge coins when reactivating a cancelled redemption
  if v_status = 'cancelled' and p_status <> 'cancelled' then
    insert into public.partner_coin_transactions (partner_id, amount, reason, note)
    values (v_partner, -v_coins, 'manual_adjustment', 'חיוב מחדש על מימוש');
  end if;

  update public.partner_reward_redemptions
    set status = p_status,
        fulfilled_at = case when p_status = 'fulfilled' then now() else null end
    where id = p_id;
end;
$$;
revoke execute on function public.set_partner_redemption_status(uuid, text) from anon;

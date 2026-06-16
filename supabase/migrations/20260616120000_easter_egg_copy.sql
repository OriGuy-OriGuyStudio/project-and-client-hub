-- ============================================================
-- 0041 — Easter-egg ledger copy fix
-- The credit-ledger line for discovering the warp easter egg used a literal
-- translation ("גילוי הביצה הנסתרת") that reads badly in Hebrew. Reword it,
-- both for future claims (the function) and for any rows already written.
-- Purely cosmetic: only the `note` text changes, never an amount.
-- ============================================================

create or replace function public.claim_easter_egg()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_enrolled boolean;
begin
  if v_uid is null then raise exception 'לא מחובר'; end if;
  if public.get_my_role() <> 'client' then
    return json_build_object('granted', false, 'reason', 'not_client');
  end if;
  if exists (select 1 from public.easter_egg_claims where client_id = v_uid) then
    return json_build_object('granted', false, 'already', true);
  end if;
  insert into public.easter_egg_claims (client_id) values (v_uid);
  insert into public.credit_transactions (client_id, amount, reason, note)
    values (v_uid, 5, 'easter_egg', 'גילית את ההפתעה הנסתרת, תג סקרן 🔭');
  v_enrolled := exists (select 1 from public.partner_enrollments where client_id = v_uid);
  return json_build_object('granted', true, 'coins', 5, 'enrolled', v_enrolled);
end;
$$;
revoke execute on function public.claim_easter_egg() from anon;
grant execute on function public.claim_easter_egg() to authenticated;

-- Fix the copy on rows already written by the old function.
update public.credit_transactions
  set note = 'גילית את ההפתעה הנסתרת, תג סקרן 🔭'
  where reason = 'easter_egg'
    and note = 'גילוי הביצה הנסתרת - תג סקרן';

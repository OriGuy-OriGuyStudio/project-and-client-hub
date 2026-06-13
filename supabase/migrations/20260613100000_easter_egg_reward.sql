-- ============================================================
-- 0021 — Easter-egg reward (curious badge + one-time +5 credits)
-- ============================================================
-- A client who discovers the "warp" easter egg (clicking the Orion footer
-- wordmark) earns 5 credits + a "curious" badge, EXACTLY ONCE. The credits land
-- in the existing ledger whether or not the client is enrolled in the partner
-- program — so when they later enrol, they start from 5.

-- Allow the new ledger reason.
alter table public.credit_transactions drop constraint credit_transactions_reason_check;
alter table public.credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('referral_submitted','deal_closed','reward_redeemed','manual_adjustment','easter_egg'));

-- One-time discovery record (also the "curious" badge marker). PK on client_id
-- makes the bonus claimable exactly once, even under concurrent calls.
create table public.easter_egg_claims (
  client_id  uuid primary key references public.profiles on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.easter_egg_claims enable row level security;
create policy "eec_select" on public.easter_egg_claims
  for select to authenticated
  using (client_id = auth.uid() or public.is_admin());
-- No write policy → only the SECURITY DEFINER RPC below can insert.

-- Claim the bonus: +5 credits, ONCE per client. Returns whether it was newly
-- granted (UI shows the popup only on first discovery) and whether the client is
-- already enrolled in the partner program.
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
    values (v_uid, 5, 'easter_egg', 'גילוי הביצה הנסתרת - תג סקרן');
  v_enrolled := exists (select 1 from public.partner_enrollments where client_id = v_uid);
  return json_build_object('granted', true, 'coins', 5, 'enrolled', v_enrolled);
end;
$$;
revoke execute on function public.claim_easter_egg() from anon;
grant execute on function public.claim_easter_egg() to authenticated;

-- ============================================================
-- 0026 — Partner coins + commission-tier ladder (chunk 1)
-- Coins are an engagement layer ON TOP of the cash commission.
-- Earn 20 coins per CLOSED deal; performance tiers move the base
-- commission 5% -> 10%. All integrity enforced server-side
-- (SECURITY DEFINER fns + AFTER trigger), never client-side.
-- ============================================================

-- 1. Coin ledger (append-only; inserts only via the definer trigger/RPCs below)
create table if not exists public.partner_coin_transactions (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.profiles(id) on delete cascade,
  amount      int  not null,
  reason      text check (reason in ('deal_closed','reward_redeemed','manual_adjustment')),
  lead_id     uuid references public.partner_leads(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists partner_coin_tx_partner_idx on public.partner_coin_transactions (partner_id);

alter table public.partner_coin_transactions enable row level security;
-- Partner sees own ledger; admin sees all. No partner INSERT/UPDATE/DELETE
-- (writes happen through SECURITY DEFINER code only).
drop policy if exists partner_coins_select on public.partner_coin_transactions;
create policy partner_coins_select on public.partner_coin_transactions
  for select to authenticated using (partner_id = auth.uid() or public.is_admin());
drop policy if exists partner_coins_admin_all on public.partner_coin_transactions;
create policy partner_coins_admin_all on public.partner_coin_transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2. Balance helper (guarded so a partner can't read someone else's balance)
create or replace function public.get_partner_coins(p_partner uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  if p_partner <> auth.uid() and not public.is_admin() then
    return 0;
  end if;
  select coalesce(sum(amount), 0)::int into v
  from public.partner_coin_transactions where partner_id = p_partner;
  return v;
end;
$$;
revoke execute on function public.get_partner_coins(uuid) from anon;

-- 3. Tier columns on partner_profiles
alter table public.partner_profiles
  add column if not exists tier        text    not null default 'bronze',
  add column if not exists tier_locked boolean not null default false;

-- 4. Tier ladder: closed-deal count -> (tier, base commission %)
--    bronze 5% · silver 6.5% @3 · gold 8% @7 · platinum 9% @12 · ambassador 10% @20
create or replace function public.partner_tier_for(closed_count int)
returns table(tier text, rate numeric) language sql immutable as $$
  select
    case
      when closed_count >= 20 then 'ambassador'
      when closed_count >= 12 then 'platinum'
      when closed_count >= 7  then 'gold'
      when closed_count >= 3  then 'silver'
      else 'bronze'
    end,
    case
      when closed_count >= 20 then 10.0
      when closed_count >= 12 then 9.0
      when closed_count >= 7  then 8.0
      when closed_count >= 3  then 6.5
      else 5.0
    end::numeric;
$$;

-- 5. Recompute a partner's tier + base commission from their closed-deal count.
--    Skips partners flagged tier_locked (negotiated/custom rates).
create or replace function public.recompute_partner_tier(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_closed int; v_tier text; v_rate numeric; v_locked boolean;
begin
  select tier_locked into v_locked from public.partner_profiles where id = p_partner;
  if v_locked is null then return; end if;          -- no partner_profiles row
  if v_locked then return; end if;                  -- admin opted this partner out
  select count(*) into v_closed
    from public.partner_leads where partner_id = p_partner and status = 'closed';
  select t.tier, t.rate into v_tier, v_rate from public.partner_tier_for(v_closed) t;
  update public.partner_profiles
    set tier = v_tier, commission_rate = v_rate
    where id = p_partner;
end;
$$;

-- 6. On a lead closing: award 20 coins once + bump tier. On re-opening: reverse.
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
  elsif old.status = 'closed' and new.status is distinct from 'closed' then
    delete from public.partner_coin_transactions
      where lead_id = new.id and reason = 'deal_closed';
    perform public.recompute_partner_tier(new.partner_id);
  end if;
  return new;
end;
$$;
drop trigger if exists partner_leads_closed_rewards on public.partner_leads;
create trigger partner_leads_closed_rewards
  after update on public.partner_leads
  for each row execute function public.partner_lead_closed_rewards();

-- 7. Backfill: protect negotiated partners, then set tiers + grant coins for
--    deals that are already closed (one-time, idempotent via the not-exists check).
update public.partner_profiles
  set tier_locked = true
  where commission_rate_min is not null or commission_rate_max is not null;

do $$
declare r record;
begin
  -- grant coins for already-closed leads that have none yet
  for r in
    select pl.id, pl.partner_id
    from public.partner_leads pl
    where pl.status = 'closed'
      and not exists (
        select 1 from public.partner_coin_transactions t
        where t.lead_id = pl.id and t.reason = 'deal_closed'
      )
  loop
    insert into public.partner_coin_transactions (partner_id, amount, reason, lead_id, note)
    values (r.partner_id, 20, 'deal_closed', r.id, 'עסקה נסגרה (backfill)');
  end loop;
  -- recompute every partner's tier
  for r in select id from public.partner_profiles loop
    perform public.recompute_partner_tier(r.id);
  end loop;
end $$;

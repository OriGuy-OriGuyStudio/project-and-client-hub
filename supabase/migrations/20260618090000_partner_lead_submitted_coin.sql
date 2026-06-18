-- ============================================================
-- 0046 — Partner earns a coin when a lead is submitted (parity with clients)
-- A CLIENT gets +1 credit the moment they submit a referral (referrals insert
-- trigger). A PARTNER only got coins when a deal CLOSED (+20). Mirror the client
-- flow: +1 coin the moment a lead is submitted for the partner — via the landing
-- form (submit_referral_lead), the partner portal form, or an admin-added lead.
-- ============================================================

-- Allow the new ledger reason on partner coins.
alter table public.partner_coin_transactions drop constraint partner_coin_transactions_reason_check;
alter table public.partner_coin_transactions add constraint partner_coin_transactions_reason_check
  check (reason in ('deal_closed','reward_redeemed','manual_adjustment','gift','compensation','easter_egg','lead_submitted'));

-- +1 coin per submitted lead, once per lead (idempotent on lead_id).
create or replace function public.partner_lead_submitted_reward()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.partner_coin_transactions
    where lead_id = new.id and reason = 'lead_submitted'
  ) then
    insert into public.partner_coin_transactions (partner_id, amount, reason, lead_id, note)
    values (new.partner_id, 1, 'lead_submitted', new.id, 'ליד הוגש');
  end if;
  return new;
end;
$$;

drop trigger if exists partner_leads_submitted_reward on public.partner_leads;
create trigger partner_leads_submitted_reward
  after insert on public.partner_leads
  for each row execute function public.partner_lead_submitted_reward();

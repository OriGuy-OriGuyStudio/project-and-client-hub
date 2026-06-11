-- ============================================================
-- 0003 — Partner program (enrollment, referrals, credit ledger, rewards)
-- ============================================================

create table public.partner_enrollments (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null unique references public.profiles on delete cascade,
  enrolled_at       timestamptz not null default now(),
  terms_accepted_at timestamptz,
  terms_version     text
);

create table public.referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_id          uuid not null references public.profiles on delete cascade,
  referred_name        text not null,
  referred_contact     text not null,
  note                 text,
  status               text not null default 'submitted' check (status in ('submitted','in_progress','closed','not_relevant')),
  deal_value           numeric(10,2),
  payment_method       text check (payment_method in ('bit','bank_transfer')),
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid references public.profiles on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index referrals_referrer_idx on public.referrals (referrer_id);

create trigger referrals_set_updated_at
  before update on public.referrals
  for each row execute function public.set_updated_at();

-- Immutable ledger: only ever INSERT rows. Balance = SUM(amount).
create table public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles on delete cascade,
  amount      int not null,  -- positive = earned, negative = redeemed
  reason      text check (reason in ('referral_submitted','deal_closed','reward_redeemed','manual_adjustment')),
  referral_id uuid references public.referrals on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles on delete set null
);
create index credit_transactions_client_idx on public.credit_transactions (client_id);

create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  credit_cost int not null,
  reward_type text check (reward_type in ('studio_pro','custom')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.reward_redemptions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles on delete cascade,
  reward_id     uuid not null references public.rewards on delete restrict,
  credits_spent int not null,
  redeemed_at   timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending','fulfilled')),
  fulfilled_at  timestamptz
);
create index reward_redemptions_client_idx on public.reward_redemptions (client_id);

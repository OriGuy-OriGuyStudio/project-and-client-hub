-- ============================================================
-- 0036 — Coin value (₪ per coin) for the rewards-store editor
-- Backs the admin "store settings" calculator: convert a gift's
-- shekel value into a coin cost. Editable, readable by all so a
-- future client-facing "your coins are worth ₪X" hint can use it.
-- ============================================================

alter table public.studio_settings
  add column if not exists ils_per_coin numeric(10,2) not null default 1
    check (ils_per_coin > 0);

comment on column public.studio_settings.ils_per_coin is
  'How many ILS one coin/credit is worth. coins = round(gift_ils / ils_per_coin).';

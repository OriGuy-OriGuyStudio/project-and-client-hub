-- ============================================================
-- Quote system v2 , schema foundation.
-- Reshapes price_quotes with v2 top-level columns (type/subtype/final_price/
-- anchor_value/client_business/sent_at/viewed_at/signed_ip), extends the
-- quote_catalog kinds (adds subtype/module/automation), and adds a per-type
-- multipliers table (fair/recommended/premium + premium floor). See spec
-- 2026-07-15-quote-system-v2-design.md (§10 + §13).
-- ============================================================

alter table public.price_quotes
  add column if not exists type text not null default 'website'
    check (type in ('website','system','automation')),
  add column if not exists subtype text,
  add column if not exists final_price numeric,
  add column if not exists anchor_value numeric,
  add column if not exists client_business text,
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists signed_ip text;

alter table public.quote_catalog
  drop constraint if exists quote_catalog_kind_check;
alter table public.quote_catalog
  add constraint quote_catalog_kind_check
  check (kind in ('subtype','page','feature','module','automation','upsell'));

create table if not exists public.quote_type_multipliers (
  type        text primary key check (type in ('website','system','automation')),
  fair        numeric not null default 1,
  recommended numeric not null default 1.25,
  premium     numeric not null default 1.5,
  floor       numeric not null default 0
);
insert into public.quote_type_multipliers (type, floor) values
  ('website', 4500), ('system', 12000), ('automation', 2500)
on conflict (type) do nothing;

alter table public.quote_type_multipliers enable row level security;
create policy "qtm_admin" on public.quote_type_multipliers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 0060 — Per-brand logo fit override
-- BrandLogo auto-detects fit vs fill, but the admin can pin a logo to a mode
-- when the heuristic guesses wrong. 'auto' = let the component decide.
-- ============================================================

alter table public.client_brand
  add column if not exists logo_fit text not null default 'auto'
  check (logo_fit in ('auto', 'contain', 'cover'));

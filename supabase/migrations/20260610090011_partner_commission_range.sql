-- ============================================================
-- 0011 — Partner commission can be a fixed % or a range
-- ============================================================
alter table public.partner_profiles add column if not exists commission_rate_min numeric(5,2);
alter table public.partner_profiles add column if not exists commission_rate_max numeric(5,2);
alter table public.allowed_emails  add column if not exists commission_rate_min numeric(5,2);
alter table public.allowed_emails  add column if not exists commission_rate_max numeric(5,2);

-- ensure_my_profile() / handle_new_user() updated to copy min/max into the
-- partner_profiles row (defaulting both to the fixed rate). Full bodies were
-- applied via the Supabase MCP; see project notes for the canonical versions.

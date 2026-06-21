-- ============================================================
-- 0067 — Optional partner link on an admin task
-- Lets a task point at a partner (שת"פ) too, so the row can deep-link to the
-- partner's page (alongside the project's client).
-- ============================================================

alter table public.admin_tasks
  add column if not exists partner_id uuid references public.profiles on delete set null;

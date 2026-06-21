-- ============================================================
-- 0065 — Free-text note on an admin task
-- A place for Ori to jot down what he did / context.
-- ============================================================

alter table public.admin_tasks add column if not exists note text;

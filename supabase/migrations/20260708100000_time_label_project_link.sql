-- ============================================================
-- 0084 — personal time-labels can be linked to a project
-- ============================================================
-- A personal label (e.g. "עיצוב / מחקר") can optionally be tied to a project.
-- When it is, time tracked under that label also counts toward the project's
-- total and its ₪/hour rate. Nullable — an unlinked label stays purely personal.
-- ============================================================

alter table public.time_labels
  add column if not exists project_id uuid references public.projects(id) on delete set null;

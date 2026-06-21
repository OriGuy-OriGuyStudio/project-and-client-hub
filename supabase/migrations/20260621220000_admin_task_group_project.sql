-- ============================================================
-- 0064 — A task group can be tied to a project
-- Assigning a group to a project propagates that project (and its client) to
-- every task in the group. Stored here so new tasks added to the group can
-- inherit it too.
-- ============================================================

alter table public.admin_task_groups
  add column if not exists project_id uuid references public.projects on delete set null;

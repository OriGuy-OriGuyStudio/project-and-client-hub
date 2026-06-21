-- ============================================================
-- 0063 — Deleting a task group also deletes its tasks
-- Ori expects a group ("סבב תיקונים 3") to take its sub-tasks with it.
-- Switch admin_tasks.group_id from ON DELETE SET NULL to ON DELETE CASCADE.
-- ============================================================

alter table public.admin_tasks drop constraint if exists admin_tasks_group_id_fkey;
alter table public.admin_tasks
  add constraint admin_tasks_group_id_fkey
  foreign key (group_id) references public.admin_task_groups on delete cascade;

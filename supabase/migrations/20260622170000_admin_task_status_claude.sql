-- ============================================================
-- 0071 — Add the "in_progress_claude" admin-task status (בתהליך בטיפול קלוד)
-- ============================================================

alter table public.admin_tasks drop constraint if exists admin_tasks_status_check;
alter table public.admin_tasks
  add constraint admin_tasks_status_check
  check (status in ('todo', 'in_progress', 'in_progress_claude', 'done'));

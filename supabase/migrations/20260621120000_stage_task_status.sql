-- ============================================================
-- 0059 — Sub-task status (not_started / in_progress / done)
-- Sub-tasks were a binary checkbox (is_done). Ori wants the same 3-state status
-- as a stage. Add a `status` column; keep the legacy `is_done` boolean in lockstep
-- via a trigger so any existing reader still works.
-- ============================================================

alter table public.stage_tasks
  add column if not exists status text not null default 'not_started'
  check (status in ('not_started', 'in_progress', 'done'));

-- Backfill from the legacy boolean.
update public.stage_tasks set status = 'done' where is_done = true and status <> 'done';

-- Keep is_done = (status = 'done') automatically, whoever writes the row.
create or replace function public.sync_stage_task_done()
returns trigger
language plpgsql
as $$
begin
  new.is_done := (new.status = 'done');
  return new;
end;
$$;

drop trigger if exists stage_tasks_sync_done on public.stage_tasks;
create trigger stage_tasks_sync_done
  before insert or update on public.stage_tasks
  for each row execute function public.sync_stage_task_done();

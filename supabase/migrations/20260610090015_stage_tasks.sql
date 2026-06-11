-- ============================================================
-- 0015 — Per-stage sub-tasks (lightweight checklist under a roadmap stage)
-- ============================================================
-- A stage can carry a few small "todo" items. Admin-managed; clients read only
-- (same posture as project_stages). Cascades when the parent stage is deleted.

create table public.stage_tasks (
  id          uuid primary key default gen_random_uuid(),
  stage_id    uuid not null references public.project_stages on delete cascade,
  title       text not null,
  is_done     boolean not null default false,
  order_index int not null default 0,
  created_at  timestamptz not null default now()
);

create index stage_tasks_stage_idx on public.stage_tasks (stage_id, order_index);

alter table public.stage_tasks enable row level security;

-- Read: project owner (via the stage's project) or admin.
create policy "stage_tasks_select" on public.stage_tasks
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.project_stages s
      where s.id = stage_tasks.stage_id and public.owns_project(s.project_id)
    )
  );

-- Write: admin only.
create policy "stage_tasks_admin_write" on public.stage_tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

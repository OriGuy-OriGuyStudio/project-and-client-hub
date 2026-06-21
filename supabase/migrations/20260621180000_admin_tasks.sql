-- ============================================================
-- 0062 — Admin-only daily task board
-- A private to-do board for Ori: tasks with urgency, an optional linked
-- project (client is derived from it), start/end dates, and collapsible
-- groups ("סבב תיקונים 3"). Admin-only at the DB level (never visible to
-- clients/partners).
-- ============================================================

create table if not exists public.admin_task_groups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  order_index int  not null default 0,
  collapsed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.admin_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  urgency     text not null default 'medium'
              check (urgency in ('low', 'medium', 'high', 'urgent')),
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'done')),
  project_id  uuid references public.projects on delete set null,
  client_id   uuid references public.profiles on delete set null,
  group_id    uuid references public.admin_task_groups on delete set null,
  start_date  date,
  end_date    date,
  order_index int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists admin_tasks_group_idx on public.admin_tasks (group_id, order_index);

alter table public.admin_task_groups enable row level security;
alter table public.admin_tasks enable row level security;

-- Admin only — full access; everyone else gets nothing (no select policy).
create policy "admin_task_groups_admin" on public.admin_task_groups
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admin_tasks_admin" on public.admin_tasks
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- project_folders
-- Backfilled from live prod (was applied via MCP, no committed file).
-- Folders/categories for a project's files. RLS: owner + admin read; owner
-- creates own folders; owner + admin delete.
-- ============================================================

create table if not exists public.project_folders (
  id         uuid not null default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_folders_pkey primary key (id),
  constraint project_folders_project_id_name_key unique (project_id, name)
);
create index if not exists project_folders_project_idx on public.project_folders using btree (project_id);

alter table public.project_folders enable row level security;

create policy project_folders_select on public.project_folders
  for select to authenticated using (owns_project(project_id) or is_admin());
create policy project_folders_insert on public.project_folders
  for insert to authenticated with check (is_admin() or (owns_project(project_id) and created_by = auth.uid()));
create policy project_folders_delete on public.project_folders
  for delete to authenticated using (is_admin() or owns_project(project_id));

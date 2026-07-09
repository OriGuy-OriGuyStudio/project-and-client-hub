-- ============================================================
-- 0090 — service calls as first-class work items
-- ============================================================
-- Promotes "קריאת שירות" from a maintenance_log line to a real entity: the
-- client opens one (title + description + optional media), the admin gives it an
-- internal name + status, tracks time on it via the timer, and sees it in the
-- main-screen tasks. Client reads its own project's calls; admin manages all.
-- ============================================================

create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.profiles(id),      -- who opened it (denormalized)
  title text not null,
  description text,
  admin_label text,                                    -- internal name, admin-only
  status text not null default 'new'
    check (status in ('new','scheduled','in_progress','done','cancelled')),
  attachments jsonb not null default '[]'::jsonb,      -- [{path,mime,name}]
  created_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.service_calls enable row level security;

drop policy if exists service_calls_admin_all on public.service_calls;
create policy service_calls_admin_all on public.service_calls for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists service_calls_client_read on public.service_calls;
create policy service_calls_client_read on public.service_calls for select to authenticated
  using (public.owns_project(project_id));

create index if not exists service_calls_project on public.service_calls (project_id, created_at desc);
create index if not exists service_calls_status on public.service_calls (status);

-- time can be tracked against a specific service call
alter table public.time_sessions
  add column if not exists service_call_id uuid references public.service_calls(id) on delete set null;
create index if not exists time_sessions_service_call on public.time_sessions (service_call_id);

-- ------------------------------------------------------------
-- open_service_call: client (or admin) who owns the project opens a call.
-- Replaces the old (uuid, text) signature.
-- ------------------------------------------------------------
drop function if exists public.open_service_call(uuid, text);

create or replace function public.open_service_call(
  p_project uuid,
  p_title text,
  p_description text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 4000), '');
begin
  if not (public.is_admin() or public.owns_project(p_project)) then
    raise exception 'forbidden';
  end if;
  if v_title = '' then
    raise exception 'empty title';
  end if;

  insert into public.service_calls (project_id, client_id, title, description, attachments, created_by)
  values (
    p_project,
    auth.uid(),
    v_title,
    v_desc,
    coalesce(p_attachments, '[]'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  select coalesce(nullif(btrim(pr.full_name), ''), pr.email)
    into v_name
  from public.profiles pr
  where pr.id = auth.uid();

  insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
  values (
    'admin',
    null,
    'service_call',
    'קריאת שירות חדשה' || coalesce(' מ' || v_name, ''),
    v_title,
    '/admin/service-calls',
    p_project,
    v_id
  );

  return v_id;
end;
$$;

grant execute on function public.open_service_call(uuid, text, text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- client_service_summary: count service calls this month from the new table
-- (parent + retainer-billed children), everything else unchanged.
-- ------------------------------------------------------------
create or replace function public.client_service_summary(p_project uuid)
returns table (
  hours_month numeric, hours_total numeric, service_calls_month int,
  updates_total int, backups_total int, threats_total int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.owns_project(p_project)) then
    raise exception 'forbidden';
  end if;
  return query
  with proj as (
    select p_project as id
    union
    select id from public.projects where parent_project_id = p_project and retainer_billed
  ),
  retainer_sessions as (
    select s.duration_seconds, s.started_at
    from public.time_sessions s
    where (s.project_id = p_project and s.is_retainer)
       or s.project_id in (select id from proj where id <> p_project)
  )
  select
    coalesce((select sum(duration_seconds)::numeric / 3600 from retainer_sessions
              where started_at >= date_trunc('month', now())), 0),
    coalesce((select sum(duration_seconds)::numeric / 3600 from retainer_sessions), 0),
    coalesce((select count(*)::int from public.service_calls sc
              where sc.project_id in (select id from proj)
                and sc.created_at >= date_trunc('month', now())), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind in ('update','deploy')), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind = 'backup'), 0),
    coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm
              where sm.project_id in (select id from proj)), 0);
end;
$$;

notify pgrst, 'reload schema';

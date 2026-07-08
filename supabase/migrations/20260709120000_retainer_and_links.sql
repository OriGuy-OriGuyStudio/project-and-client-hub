-- ============================================================
-- 0087 — retainer timer, linked feature-projects, hourly rate
-- ============================================================
-- * projects.parent_project_id — a "feature" project linked to its parent
--   (the parent holds the service plan / retainer).
-- * time_sessions.is_retainer — this session counts toward the retainer hours.
-- * project_service.hourly_rate — ₪/hour for the package value + overage.
-- Retainer hours for a project P = time tagged is_retainer on P itself
--   + ALL time on projects whose parent_project_id = P.
-- ============================================================

alter table public.projects
  add column if not exists parent_project_id uuid references public.projects(id) on delete set null;
create index if not exists projects_parent_idx on public.projects (parent_project_id);

alter table public.time_sessions
  add column if not exists is_retainer boolean not null default false;

alter table public.project_service
  add column if not exists hourly_rate numeric;

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
    select id from public.projects where parent_project_id = p_project
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
    coalesce((select count(*)::int from public.maintenance_log m
              where m.project_id = p_project and m.kind = 'service_call'
                and m.occurred_at >= date_trunc('month', now())), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind in ('update','deploy')), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind = 'backup'), 0),
    coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm
              where sm.project_id in (select id from proj)), 0);
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- 0088 — linked project can be "counts toward retainer" or "linked but independent"
-- ============================================================
-- A child project (parent_project_id set) may either roll its hours into the
-- parent's retainer, or just be *associated* with it for visibility without
-- affecting the retainer. retainer_billed distinguishes the two.
-- ============================================================

alter table public.projects
  add column if not exists retainer_billed boolean not null default true;

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
    -- only linked children that count toward the retainer
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

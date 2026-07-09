-- ============================================================
-- 0091 — service-call counter includes admin log + status notifications
-- ============================================================
-- * client_service_summary.service_calls_month now counts BOTH client-opened
--   service_calls AND admin-logged maintenance_log(kind='service_call') this
--   month, so a call the admin logs by hand also shows on the client dashboard.
-- * A trigger notifies the client (in-app) when a call moves to in_progress/done.
--   The status email is sent best-effort from the app (notify-service-status fn).
-- ============================================================

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
    -- client-opened calls + admin-logged calls, this month
    coalesce((select count(*)::int from public.service_calls sc
              where sc.project_id in (select id from proj)
                and sc.created_at >= date_trunc('month', now())), 0)
    + coalesce((select count(*)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind = 'service_call'
                and m.occurred_at >= date_trunc('month', now())), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind in ('update','deploy')), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind = 'backup'), 0),
    coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm
              where sm.project_id in (select id from proj)), 0);
end;
$$;

create or replace function public.notify_service_call_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('in_progress', 'done')
     and new.client_id is not null then
    insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
    values (
      'client',
      new.client_id,
      'service_call_status',
      case when new.status = 'done' then 'קריאת השירות שלך טופלה' else 'קריאת השירות שלך בטיפול' end,
      case when new.status = 'done'
           then 'הקריאה "' || new.title || '" סומנה כטופלה.'
           else 'התחלנו לטפל בקריאה "' || new.title || '".' end,
      '/service',
      new.project_id,
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists service_calls_notify_status on public.service_calls;
create trigger service_calls_notify_status
  after update on public.service_calls
  for each row execute function public.notify_service_call_status();

notify pgrst, 'reload schema';

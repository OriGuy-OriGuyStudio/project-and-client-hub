-- ============================================================
-- 0094 — admin maintenance overview + public dashboard preview
-- ============================================================
-- * admin_maintenance_overview(): one call, every active package with its latest
--   metrics, retainer hours this month, and open service-call count — for the
--   admin "חבילות תחזוקה" tab (spot anomalies to be proactive).
-- * project_service.preview_token + service_preview(token): a public, read-only
--   snapshot of a client's "השירות שלך" dashboard, so the studio can share a link
--   (used for the demo client to showcase the package to prospects).
-- ============================================================

create or replace function public.admin_maintenance_overview()
returns table (
  project_id uuid, project_title text, client_name text, client_email text,
  tier text, site_type text, site_url text, hourly_rate numeric, monthly_price numeric,
  preview_token text,
  pagespeed int, uptime_pct numeric, threats_blocked int, lcp_ms int, last_metric_date date,
  hours_month numeric, open_calls int
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select
    p.id, p.title, coalesce(nullif(btrim(pr.full_name), ''), pr.email), pr.email,
    ps.tier, ps.site_type, ps.site_url, ps.hourly_rate, ps.monthly_price,
    ps.preview_token,
    sm.pagespeed, sm.uptime_pct, sm.threats_blocked, sm.lcp_ms, sm.metric_date,
    coalesce((
      select sum(s.duration_seconds)::numeric / 3600 from public.time_sessions s
      where s.started_at >= date_trunc('month', now())
        and ((s.project_id = p.id and s.is_retainer)
             or s.project_id in (select c.id from public.projects c
                                 where c.parent_project_id = p.id and c.retainer_billed))
    ), 0),
    coalesce((select count(*)::int from public.service_calls sc
              where sc.project_id = p.id and sc.status in ('new','scheduled','in_progress')), 0)
  from public.project_service ps
  join public.projects p on p.id = ps.project_id
  left join public.profiles pr on pr.id = p.client_id
  left join lateral (
    select m.pagespeed, m.uptime_pct, m.threats_blocked, m.lcp_ms, m.metric_date
    from public.site_metrics m where m.project_id = p.id
    order by m.metric_date desc limit 1
  ) sm on true
  where ps.active
  order by pr.full_name, p.title;
end;
$$;

alter table public.project_service add column if not exists preview_token text unique;

create or replace function public.service_preview(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_proj uuid;
  v_result jsonb;
begin
  select project_id into v_proj from public.project_service
  where preview_token = p_token and active;
  if v_proj is null then return null; end if;

  select jsonb_build_object(
    'service', to_jsonb(ps.*),
    'project_title', p.title,
    'business_name', coalesce(nullif(btrim(cb.business_name), ''), p.title),
    'metrics', coalesce((
      select jsonb_agg(to_jsonb(m.*) order by m.metric_date desc)
      from public.site_metrics m where m.project_id = v_proj), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(to_jsonb(l.*) order by l.occurred_at desc)
      from public.maintenance_log l where l.project_id = v_proj), '[]'::jsonb),
    'summary', (
      with proj as (
        select v_proj as id
        union
        select id from public.projects where parent_project_id = v_proj and retainer_billed
      ),
      rs as (
        select s.duration_seconds, s.started_at from public.time_sessions s
        where (s.project_id = v_proj and s.is_retainer)
           or s.project_id in (select id from proj where id <> v_proj)
      )
      select jsonb_build_object(
        'hours_month', coalesce((select sum(duration_seconds)::numeric/3600 from rs where started_at >= date_trunc('month', now())), 0),
        'hours_total', coalesce((select sum(duration_seconds)::numeric/3600 from rs), 0),
        'service_calls_month',
          coalesce((select count(*)::int from public.service_calls sc where sc.project_id in (select id from proj) and sc.created_at >= date_trunc('month', now())), 0)
          + coalesce((select count(*)::int from public.maintenance_log m where m.project_id in (select id from proj) and m.kind='service_call' and m.occurred_at >= date_trunc('month', now())), 0),
        'updates_total', coalesce((select sum(m.count)::int from public.maintenance_log m where m.project_id in (select id from proj) and m.kind in ('update','deploy')), 0),
        'backups_total', coalesce((select sum(m.count)::int from public.maintenance_log m where m.project_id in (select id from proj) and m.kind='backup'), 0),
        'threats_total', coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm where sm.project_id in (select id from proj)), 0)
      )
    )
  ) into v_result
  from public.project_service ps
  join public.projects p on p.id = ps.project_id
  left join public.client_brand cb on cb.client_id = p.client_id
  where ps.project_id = v_proj;

  return v_result;
end;
$$;

grant execute on function public.service_preview(text) to anon, authenticated;

notify pgrst, 'reload schema';

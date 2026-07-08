-- ============================================================
-- 0086 — service & maintenance plans (client-facing "השירות שלך")
-- ============================================================
-- Per-site maintenance retainer (Core/Pro/Ultra) shown transparently to the
-- client. project_service = the client's plan (admin sets, client reads own).
-- site_metrics + maintenance_log are filled by automation (n8n: Cloudflare,
-- PageSpeed, uptime) or the admin; the client reads its own site's data.
-- Work-hours (from admin-only time_sessions) are exposed only as a safe
-- aggregate via client_service_summary().
-- ============================================================

create table if not exists public.project_service (
  project_id uuid primary key references public.projects(id) on delete cascade,
  tier text not null default 'core' check (tier in ('core','pro','ultra')),
  site_type text not null default 'wordpress' check (site_type in ('wordpress','custom')),
  site_url text,
  monthly_price numeric,               -- optional override; else the tier default
  started_at date,
  billing_day int not null default 1 check (billing_day between 1 and 28),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.project_service enable row level security;
drop policy if exists project_service_admin on public.project_service;
create policy project_service_admin on public.project_service for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists project_service_client_read on public.project_service;
create policy project_service_client_read on public.project_service for select to authenticated
  using (public.owns_project(project_id));

create table if not exists public.site_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  metric_date date not null,
  visitors int, pageviews int, sessions int,
  pagespeed int, lcp_ms int, cls numeric, inp_ms int,
  uptime_pct numeric, threats_blocked int,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, metric_date)
);
alter table public.site_metrics enable row level security;
drop policy if exists site_metrics_admin on public.site_metrics;
create policy site_metrics_admin on public.site_metrics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists site_metrics_client_read on public.site_metrics;
create policy site_metrics_client_read on public.site_metrics for select to authenticated
  using (public.owns_project(project_id));
create index if not exists site_metrics_project_date on public.site_metrics (project_id, metric_date desc);

create table if not exists public.maintenance_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('update','backup','scan','deploy','service_call','note')),
  title text,
  count int not null default 1,
  occurred_at timestamptz not null default now(),
  meta jsonb
);
alter table public.maintenance_log enable row level security;
drop policy if exists maintenance_log_admin on public.maintenance_log;
create policy maintenance_log_admin on public.maintenance_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists maintenance_log_client_read on public.maintenance_log;
create policy maintenance_log_client_read on public.maintenance_log for select to authenticated
  using (public.owns_project(project_id));
create index if not exists maintenance_log_project on public.maintenance_log (project_id, occurred_at desc);

-- safe aggregate for the client page: hours (from admin-only time_sessions) +
-- service calls, for a project the caller owns (or admin). Never exposes rows.
create or replace function public.client_service_summary(p_project uuid)
returns table (
  hours_month numeric,
  hours_total numeric,
  service_calls_month int,
  updates_total int,
  backups_total int,
  threats_total int
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
  select
    coalesce((select sum(s.duration_seconds)::numeric / 3600 from public.time_sessions s
              where s.project_id = p_project and s.started_at >= date_trunc('month', now())), 0),
    coalesce((select sum(s.duration_seconds)::numeric / 3600 from public.time_sessions s
              where s.project_id = p_project), 0),
    coalesce((select count(*)::int from public.maintenance_log m
              where m.project_id = p_project and m.kind = 'service_call'
                and m.occurred_at >= date_trunc('month', now())), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id = p_project and m.kind in ('update','deploy')), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id = p_project and m.kind = 'backup'), 0),
    coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm
              where sm.project_id = p_project), 0);
end;
$$;

notify pgrst, 'reload schema';

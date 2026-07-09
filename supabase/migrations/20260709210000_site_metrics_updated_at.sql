-- ============================================================
-- site_metrics.updated_at — expose when a day's metrics were last refreshed,
-- so the client "השירות שלך" page and the admin "חבילות תחזוקה" page can show
-- a "עודכן לאחרונה" date+time. created_at is insert-time (first poll of the day)
-- and never moves on later refreshes, so it can't serve as "last updated".
-- ============================================================

-- Add nullable, backfill existing rows to their created_at (not the migration
-- moment), then lock down to NOT NULL DEFAULT now().
alter table public.site_metrics add column if not exists updated_at timestamptz;
update public.site_metrics set updated_at = created_at where updated_at is null;
alter table public.site_metrics alter column updated_at set default now();
alter table public.site_metrics alter column updated_at set not null;

-- The poller upserts today's row every run; bump updated_at on every write.
create or replace function public.upsert_site_metrics(
  p_project uuid, p_date date,
  p_visitors integer default null, p_pageviews integer default null, p_sessions integer default null,
  p_pagespeed integer default null, p_lcp_ms integer default null, p_cls numeric default null,
  p_inp_ms integer default null, p_uptime_pct numeric default null, p_threats_blocked integer default null,
  p_meta jsonb default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.site_metrics
    (project_id, metric_date, visitors, pageviews, sessions, pagespeed, lcp_ms, cls, inp_ms, uptime_pct, threats_blocked, meta)
  values
    (p_project, p_date, p_visitors, p_pageviews, p_sessions, p_pagespeed, p_lcp_ms, p_cls, p_inp_ms, p_uptime_pct, p_threats_blocked, p_meta)
  on conflict (project_id, metric_date) do update set
    visitors        = coalesce(excluded.visitors, site_metrics.visitors),
    pageviews       = coalesce(excluded.pageviews, site_metrics.pageviews),
    sessions        = coalesce(excluded.sessions, site_metrics.sessions),
    pagespeed       = coalesce(excluded.pagespeed, site_metrics.pagespeed),
    lcp_ms          = coalesce(excluded.lcp_ms, site_metrics.lcp_ms),
    cls             = coalesce(excluded.cls, site_metrics.cls),
    inp_ms          = coalesce(excluded.inp_ms, site_metrics.inp_ms),
    uptime_pct      = coalesce(excluded.uptime_pct, site_metrics.uptime_pct),
    threats_blocked = coalesce(excluded.threats_blocked, site_metrics.threats_blocked),
    meta            = coalesce(excluded.meta, site_metrics.meta),
    updated_at      = now();
end;
$function$;

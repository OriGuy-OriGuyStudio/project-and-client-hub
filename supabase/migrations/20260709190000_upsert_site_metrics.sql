-- ============================================================
-- 0093 — merge-upsert for site_metrics (multi-source safe)
-- ============================================================
-- Different monitoring sources write different columns of the SAME daily row
-- (PageSpeed → speed; UptimeRobot → uptime; Cloudflare → traffic/threats). A
-- plain upsert replaces the whole row and would null the others' columns. This
-- RPC only overwrites the columns whose new value is non-null (coalesce), so
-- each source updates its own fields without clobbering the rest.
-- ============================================================

create or replace function public.upsert_site_metrics(
  p_project uuid,
  p_date date,
  p_visitors int default null,
  p_pageviews int default null,
  p_sessions int default null,
  p_pagespeed int default null,
  p_lcp_ms int default null,
  p_cls numeric default null,
  p_inp_ms int default null,
  p_uptime_pct numeric default null,
  p_threats_blocked int default null,
  p_meta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    meta            = coalesce(excluded.meta, site_metrics.meta);
end;
$$;

notify pgrst, 'reload schema';

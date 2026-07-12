-- ============================================================
-- 20260712260000 — extend upsert_site_metrics for Cloudflare fields
-- ============================================================
-- pull-cloudflare-metrics writes requests/cached_requests/bytes/turnstile_*
-- (added to site_metrics by 20260712250000_cf_metrics_schema.sql) alongside
-- the existing pagespeed/uptime/threats/visitors fields other sources write.
-- Reuse the same atomic coalesce-upsert RPC (instead of a select-then-upsert
-- in the edge function, which has a TOCTOU race against concurrent writers
-- like poll-site-metrics / ingest-site-metrics for the same project/day row).
--
-- New params are appended at the END with defaults, and every existing param
-- (name/type/order/default) plus every existing coalesce column is left
-- unchanged, so ingest-site-metrics and poll-site-metrics (which both call
-- this RPC with named args) keep working untouched.
-- ============================================================

drop function if exists public.upsert_site_metrics(
  uuid, date, integer, integer, integer, integer, integer, numeric, integer, numeric, integer, jsonb
);

create function public.upsert_site_metrics(
  p_project uuid,
  p_date date,
  p_visitors integer default null,
  p_pageviews integer default null,
  p_sessions integer default null,
  p_pagespeed integer default null,
  p_lcp_ms integer default null,
  p_cls numeric default null,
  p_inp_ms integer default null,
  p_uptime_pct numeric default null,
  p_threats_blocked integer default null,
  p_meta jsonb default null,
  p_requests bigint default null,
  p_cached_requests bigint default null,
  p_bytes bigint default null,
  p_turnstile_solved integer default null,
  p_turnstile_blocked integer default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.site_metrics
    (project_id, metric_date, visitors, pageviews, sessions, pagespeed, lcp_ms, cls, inp_ms, uptime_pct, threats_blocked, meta,
     requests, cached_requests, bytes, turnstile_solved, turnstile_blocked)
  values
    (p_project, p_date, p_visitors, p_pageviews, p_sessions, p_pagespeed, p_lcp_ms, p_cls, p_inp_ms, p_uptime_pct, p_threats_blocked, p_meta,
     p_requests, p_cached_requests, p_bytes, p_turnstile_solved, p_turnstile_blocked)
  on conflict (project_id, metric_date) do update set
    visitors          = coalesce(excluded.visitors, site_metrics.visitors),
    pageviews         = coalesce(excluded.pageviews, site_metrics.pageviews),
    sessions          = coalesce(excluded.sessions, site_metrics.sessions),
    pagespeed         = coalesce(excluded.pagespeed, site_metrics.pagespeed),
    lcp_ms            = coalesce(excluded.lcp_ms, site_metrics.lcp_ms),
    cls               = coalesce(excluded.cls, site_metrics.cls),
    inp_ms            = coalesce(excluded.inp_ms, site_metrics.inp_ms),
    uptime_pct        = coalesce(excluded.uptime_pct, site_metrics.uptime_pct),
    threats_blocked   = coalesce(excluded.threats_blocked, site_metrics.threats_blocked),
    meta              = coalesce(excluded.meta, site_metrics.meta),
    requests          = coalesce(excluded.requests, site_metrics.requests),
    cached_requests   = coalesce(excluded.cached_requests, site_metrics.cached_requests),
    bytes             = coalesce(excluded.bytes, site_metrics.bytes),
    turnstile_solved  = coalesce(excluded.turnstile_solved, site_metrics.turnstile_solved),
    turnstile_blocked = coalesce(excluded.turnstile_blocked, site_metrics.turnstile_blocked),
    updated_at        = now();
end;
$function$;

-- Only the service-role edge functions (ingest-site-metrics, poll-site-metrics,
-- pull-cloudflare-metrics) write metrics. This DB's default ACL grants EXECUTE
-- directly to anon/authenticated, and this is a definer function that bypasses
-- RLS, so revoke it from client roles to prevent metric injection for any project.
revoke execute on function public.upsert_site_metrics from public, anon, authenticated;

notify pgrst, 'reload schema';

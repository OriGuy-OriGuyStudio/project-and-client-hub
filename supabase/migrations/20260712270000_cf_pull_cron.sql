-- ============================================================
-- 20260712270000 — Daily Cloudflare metrics pull (pg_cron + pg_net)
-- ============================================================
-- Schedules `pull-cloudflare-metrics` (supabase/functions/pull-cloudflare-metrics)
-- to run once a day for every active project_service package, filling
-- requests/cached_requests/bytes/threats/visitors into site_metrics via the
-- atomic upsert_site_metrics RPC (see 20260712260000_upsert_site_metrics_cf.sql).
--
-- Auth: pull-cloudflare-metrics has verify_jwt=false and checks NO incoming
-- secret (unlike warranty-reminder) — it authenticates to Cloudflare itself via
-- webhook_secrets['cloudflare_api_token']. So the cron body is just `{}`, no
-- bearer token needed.
--
-- Base URL: resolved from webhook_secrets['functions_base_url'] at run time
-- (same pattern as notify_service_activated / notify_agreement_inserted), so a
-- branch pointed at its own functions_base_url row runs against itself instead
-- of prod. Falls back to the production project URL if the row is missing.
--
-- Runs at 03:20 UTC, 5 minutes after the 03:15 R2 backup job.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cf_pull_daily',
  '20 3 * * *',
  $cron$
  select net.http_post(
    url := coalesce(
      (select value from public.webhook_secrets where name = 'functions_base_url'),
      'https://tirasinbjsotcrqggipe.supabase.co'
    ) || '/functions/v1/pull-cloudflare-metrics',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $cron$
);

notify pgrst, 'reload schema';

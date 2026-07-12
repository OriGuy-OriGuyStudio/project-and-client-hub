-- ============================================================
-- 20260712300000 — cf_pull_daily cron sends the webhook secret
-- ============================================================
-- Security fix: pull-cloudflare-metrics (supabase/functions/pull-cloudflare-metrics)
-- now requires x-webhook-secret == webhook_secrets['metrics_ingest'] (or an admin
-- JWT) before doing anything, matching poll-site-metrics's gate. The cron job
-- scheduled in 20260712270000_cf_pull_cron.sql posted body `{}` with only a
-- Content-Type header and no secret, so it would now get 401'd by its own
-- function. Re-schedule `cf_pull_daily` with the secret header added.
--
-- cron.schedule() upserts by job name, so running this again replaces the
-- existing 'cf_pull_daily' job in place (same schedule, same URL resolution).
-- ============================================================

select cron.schedule(
  'cf_pull_daily',
  '20 3 * * *',
  $cron$
  select net.http_post(
    url := coalesce(
      (select value from public.webhook_secrets where name = 'functions_base_url'),
      'https://tirasinbjsotcrqggipe.supabase.co'
    ) || '/functions/v1/pull-cloudflare-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select value from public.webhook_secrets where name = 'metrics_ingest')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

notify pgrst, 'reload schema';

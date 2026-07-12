-- Per-package Turnstile sitekey: Turnstile analytics (turnstileAdaptiveGroups in
-- the CF GraphQL API) are per-WIDGET (siteKey), account-scoped, not per-zone. So
-- to show a package's bot-check numbers, the admin sets the widget's sitekey on
-- the package, and pull-cloudflare-metrics queries that sitekey's daily count
-- into site_metrics.turnstile_blocked.
alter table public.project_service add column if not exists cf_turnstile_sitekey text;

notify pgrst, 'reload schema';

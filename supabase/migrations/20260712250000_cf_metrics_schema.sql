alter table public.project_service
  add column if not exists cf_zone_id text,
  add column if not exists cf_zone_checked_at timestamptz;

alter table public.site_metrics
  add column if not exists turnstile_solved integer,
  add column if not exists turnstile_blocked integer,
  add column if not exists requests bigint,
  add column if not exists cached_requests bigint,
  add column if not exists bytes bigint;

notify pgrst, 'reload schema';

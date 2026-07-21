-- Real Cloudways backups, replacing the blind nightly log.
-- Until now log_nightly_backups() wrote a maintenance_log 'backup' row every
-- night unconditionally, whether or not a real backup happened. Now the studio
-- TRIGGERS a real Cloudways backup per client app, verifies it completed, and
-- logs ONLY verified successes (failures alert the admin instead). The blind
-- cron is retired.

-- Which Cloudways app each service package maps to. Nullable: a package with no
-- mapping is simply skipped by the backup job (and shows up in the admin UI as
-- "לא מחובר לגיבוי").
alter table public.project_service
  add column if not exists cloudways_server_id text,
  add column if not exists cloudways_app_id text;

-- One row per triggered backup, so the daily job can trigger tonight and verify
-- on the next run (Cloudways backups are async and take a minute+). status:
-- pending → success (logged) | failed (admin alerted).
create table if not exists public.cloudways_backup_runs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  server_id     text not null,
  app_id        text not null,
  operation_id  text,
  status        text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  error         text,
  triggered_at  timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists cloudways_backup_runs_pending_idx
  on public.cloudways_backup_runs (status) where status = 'pending';
create index if not exists cloudways_backup_runs_project_idx
  on public.cloudways_backup_runs (project_id, triggered_at desc);

alter table public.cloudways_backup_runs enable row level security;
-- Admin-only visibility; the edge function writes with the service role.
drop policy if exists cloudways_backup_runs_admin on public.cloudways_backup_runs;
create policy cloudways_backup_runs_admin on public.cloudways_backup_runs
  for select using (public.is_admin());

-- Admin: set/clear a project's Cloudways mapping (from the service admin UI).
create or replace function public.admin_set_cloudways_app(p_project uuid, p_server_id text, p_app_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.project_service set
    cloudways_server_id = nullif(btrim(coalesce(p_server_id, '')), ''),
    cloudways_app_id = nullif(btrim(coalesce(p_app_id, '')), ''),
    updated_at = now()
  where project_id = p_project;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_service'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.admin_set_cloudways_app(uuid, text, text) from public, anon;
grant execute on function public.admin_set_cloudways_app(uuid, text, text) to authenticated;

-- Retire the blind logger and its cron; the edge function owns backups now.
do $$ begin
  perform cron.unschedule('nightly_backups');
exception when others then null;  -- job may not exist on this DB
end $$;

-- Nightly: invoke the cloudways-backup edge function (it finalizes yesterday's
-- pending runs and triggers today's). Auth via the shared metrics_ingest secret,
-- same pattern as cf_pull_daily.
select cron.schedule(
  'cloudways_backups_daily',
  '10 3 * * *',
  $cron$
  select net.http_post(
    url := coalesce(
      (select value from public.webhook_secrets where name = 'functions_base_url'),
      'https://tirasinbjsotcrqggipe.supabase.co'
    ) || '/functions/v1/cloudways-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (select value from public.webhook_secrets where name = 'metrics_ingest')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

notify pgrst, 'reload schema';

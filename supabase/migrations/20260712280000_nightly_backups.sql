-- ============================================================
-- 20260712280000 — Nightly per-project backup log (pg_cron)
-- ============================================================
-- Logs one `maintenance_log` row (kind='backup') per active `project_service`
-- package per day, representing the nightly automated backup. Idempotent per
-- day (won't double-insert if run twice, or re-run manually after the cron
-- already fired). The client Service page already reads maintenance_log rows
-- with kind='backup' for the "גיבויים" tile/chart (src/pages/client/Service.tsx).
--
-- maintenance_log columns (confirmed): id uuid pk default gen_random_uuid(),
-- project_id uuid not null (fk projects), kind text not null (check in
-- update/backup/scan/deploy/service_call/note), title text nullable,
-- count int not null default 1, occurred_at timestamptz not null default
-- now(), meta jsonb nullable. Only project_id/kind/title/occurred_at need
-- to be supplied; id/count default correctly.
--
-- Runs at 03:10 UTC, 10 minutes before the 03:20 Cloudflare metrics pull.
-- ============================================================

create or replace function public.log_nightly_backups()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  insert into public.maintenance_log (project_id, kind, title, occurred_at)
  select ps.project_id, 'backup', 'גיבוי אוטומטי', now()
  from public.project_service ps
  where ps.active
    and not exists (
      select 1 from public.maintenance_log ml
      where ml.project_id = ps.project_id and ml.kind = 'backup'
        and ml.occurred_at::date = now()::date);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke execute on function public.log_nightly_backups() from public;

select cron.schedule(
  'nightly_backups',
  '10 3 * * *',
  $cron$ select public.log_nightly_backups(); $cron$
);

notify pgrst, 'reload schema';

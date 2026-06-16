-- ============================================================
-- 0014 — Enriched notifications: mark-read RPC
-- Backfilled from live prod (was a stub). The project_id/entity_id columns and
-- the enriched trigger titles are folded into the current-state 0013 file, so
-- this file now only adds the mark-as-read RPC used when the admin opens a
-- project (clears that project's admin notification badges).
-- ============================================================

create or replace function public.mark_project_notifications_read(p_project_id uuid)
returns void language sql security definer set search_path to 'public' as $function$
  update public.notifications set is_read = true
  where audience = 'admin' and project_id = p_project_id and is_read = false
    and public.is_admin();
$function$;

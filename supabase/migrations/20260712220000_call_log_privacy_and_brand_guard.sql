-- Final whole-branch review fixes for the org-centric-admin work.
--
-- Fix 1 (security): Task 10 added client_call_logs_org_select (SELECT,
-- is_admin() OR is_org_member(org_id)), which lets ANY org member -- including
-- a basic client -- read client_call_logs. Those are studio-private CRM notes
-- and must stay admin-only at the DB level (CLAUDE.md: CRM is "blocked at the
-- DB level for clients, not just hidden"; the sibling table admin_client_notes
-- is is_admin()-only). The only consumer of the org-scoped read is the
-- admin-only BusinessDetail page (useOrgCallLogs), which still works via the
-- pre-existing client_call_logs_admin ALL policy (is_admin()). Drop the
-- over-permissive policy; keep the org_id column (still used by the admin
-- query filter) and its Task 10 backfill untouched.
drop policy if exists client_call_logs_org_select on public.client_call_logs;

-- Fix 2 (backstop): guard against a duplicate is_org_primary per org, which
-- would make resolveOrgPrimaryClientId's .maybeSingle() throw. No violations
-- exist today, so this index creates cleanly.
create unique index if not exists client_brand_one_primary_per_org
  on public.client_brand (org_id)
  where is_org_primary;

notify pgrst, 'reload schema';

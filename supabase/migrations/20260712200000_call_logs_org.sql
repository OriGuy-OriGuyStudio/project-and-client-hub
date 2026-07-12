-- Task 10: client_call_logs.org_id + org-member read policy.
-- CRM is moving to the org level (Phase 3). admin_client_notes already has org_id
-- (Task 1); this adds the same column to client_call_logs so call logs can be
-- read org-scoped by managers, not just the admin.

alter table public.client_call_logs
  add column if not exists org_id uuid references public.organizations on delete cascade;

-- Backfill each call log's org from the client's current membership.
-- client_call_logs has 0 rows on the branch today, so this is a no-op.
update public.client_call_logs cl
  set org_id = m.org_id
  from public.organization_members m
  where m.user_id = cl.client_id and cl.org_id is null;

-- The existing policy is `client_call_logs_admin` (cmd = ALL, admin-only) --
-- there is no separate `client_call_logs_select` policy on this table (that
-- name was an assumption; verified via pg_policies before writing this).
-- Altering the ALL policy's USING clause to add org-member access would also
-- expose DELETE to org members (DELETE has no WITH CHECK to catch it), so
-- instead add a dedicated, additive SELECT policy and leave the admin ALL
-- policy (writes) completely untouched.
create policy client_call_logs_org_select on public.client_call_logs
  for select
  using (is_admin() or (select public.is_org_member(org_id)));

notify pgrst, 'reload schema';

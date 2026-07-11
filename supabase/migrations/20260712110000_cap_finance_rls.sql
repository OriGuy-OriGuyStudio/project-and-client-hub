-- ============================================================
-- Phase 2A: finance capability gate on the authoritative money tables.
-- ============================================================
-- A member sees signed agreements + payments only if they have the finance
-- capability for that project's org. Admin always. Solo-org managers have
-- can_finance=true (from the Phase 1 backfill), so this is behavior-preserving
-- until real members with can_finance=false are added.
-- ============================================================

-- service_agreements: agreements with a project gate on member_can(project,'finance');
-- a null-project agreement (rare) falls back to the client themself.
alter policy service_agreements_client_read on public.service_agreements
  using (
    case when project_id is not null
      then (select public.member_can(project_id, 'finance'))
      else (client_id = auth.uid()) end
  );

-- payments: finance-only for members.
alter policy payments_select on public.payments
  using ((select public.member_can(project_id, 'finance')) or is_admin());

notify pgrst, 'reload schema';

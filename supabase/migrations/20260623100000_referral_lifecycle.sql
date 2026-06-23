-- ============================================================
-- 0073 — Unify the client-referral lifecycle with the partner-lead one
-- Same funnel: submitted → awaiting_intro → intro_done → quote_sent →
-- client_approved → closed (won), + not_relevant. Keeps 'closed'/'not_relevant'
-- so the credit logic is untouched; migrates the old 'in_progress' rows.
-- ============================================================

alter table public.referrals drop constraint if exists referrals_status_check;

-- guard_referral() blocks status changes for non-admins and a migration has no
-- auth context, so disable it just for the data backfill.
alter table public.referrals disable trigger referrals_guard;
update public.referrals set status = 'awaiting_intro' where status = 'in_progress';
alter table public.referrals enable trigger referrals_guard;

alter table public.referrals
  add constraint referrals_status_check
  check (status in (
    'submitted', 'awaiting_intro', 'intro_done', 'quote_sent',
    'client_approved', 'closed', 'not_relevant'
  ));

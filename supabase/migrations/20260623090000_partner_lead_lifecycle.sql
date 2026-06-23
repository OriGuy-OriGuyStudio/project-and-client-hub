-- ============================================================
-- 0072 — Richer partner-lead lifecycle
-- New funnel: submitted → awaiting_intro → intro_done → quote_sent →
-- client_approved → closed (won), with not_relevant as a drop from any stage.
-- 'closed' and 'not_relevant' keep their keys so the coin/tier triggers
-- (partner_store, partner_coins_tiers, which fire on status='closed') are
-- unaffected. Existing rows on the retired values are migrated across.
-- ============================================================

alter table public.partner_leads drop constraint if exists partner_leads_status_check;

-- The guard trigger blocks status changes for non-admins, and a migration has no
-- auth context (is_admin() = false), so disable it just for this data backfill.
alter table public.partner_leads disable trigger partner_leads_guard;
update public.partner_leads set status = 'awaiting_intro' where status = 'in_review';
update public.partner_leads set status = 'client_approved' where status = 'interested';
alter table public.partner_leads enable trigger partner_leads_guard;

alter table public.partner_leads
  add constraint partner_leads_status_check
  check (status in (
    'submitted', 'awaiting_intro', 'intro_done', 'quote_sent',
    'client_approved', 'closed', 'not_relevant'
  ));

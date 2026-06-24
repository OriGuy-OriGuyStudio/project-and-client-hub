-- ============================================================
-- 0077 — Discovery session: free-text admin scratchpad
-- ============================================================
-- A sticky "general notes" pad on the discovery-session page, for the admin to
-- jot notes during the call. Internal only (never shown to the client), separate
-- from client_summary / follow_up. Additive + nullable, safe for prod.
-- ============================================================

alter table public.discovery_sessions
  add column if not exists admin_notes text;

notify pgrst, 'reload schema';

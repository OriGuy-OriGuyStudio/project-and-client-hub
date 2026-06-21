-- ============================================================
-- 0058 — Per-project meeting link ("קביעת פגישה")
-- Ori sends a fresh Google Meet link per meeting (varies by meeting type),
-- so it's a plain editable URL on the project, alongside the existing links.
-- ============================================================

alter table public.projects add column if not exists meeting_url text;

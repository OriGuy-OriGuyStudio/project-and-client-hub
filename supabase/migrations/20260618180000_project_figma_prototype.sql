-- ============================================================
-- 0055 — Figma prototype link on projects
-- Besides the Figma design link (figma_url), allow a separate clickable Figma
-- prototype link so the client can experience the interactive flow.
-- ============================================================

alter table public.projects add column if not exists figma_prototype_url text;
-- ============================================================
-- 0056 — Split the Figma prototype link into mobile + desktop
-- Replace the single figma_prototype_url with two: mobile and desktop, so the
-- client can open the right interactive prototype per device.
-- ============================================================

alter table public.projects drop column if exists figma_prototype_url;
alter table public.projects add column if not exists figma_prototype_mobile_url text;
alter table public.projects add column if not exists figma_prototype_desktop_url text;
-- ============================================================
-- 0057 — Collapse the two prototype links back to a single "אבטיפוס"
-- Ori wants one prototype link (not mobile + desktop). Drop the mobile column
-- and rename the desktop one to figma_prototype_url.
-- ============================================================

alter table public.projects drop column if exists figma_prototype_mobile_url;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects'
               and column_name = 'figma_prototype_desktop_url')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects'
               and column_name = 'figma_prototype_url')
  then
    alter table public.projects rename column figma_prototype_desktop_url to figma_prototype_url;
  end if;
end $$;

alter table public.projects add column if not exists figma_prototype_url text;
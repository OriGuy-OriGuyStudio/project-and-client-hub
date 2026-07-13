-- Add a 4th deliverable kind, 'copy' (AI-drafted page/section copy that follows
-- the sitemap structure), to the project_deliverables kind check.
alter table public.project_deliverables
  drop constraint if exists project_deliverables_kind_check;
alter table public.project_deliverables
  add constraint project_deliverables_kind_check
  check (kind = any (array['persona','journey','sitemap','copy']));

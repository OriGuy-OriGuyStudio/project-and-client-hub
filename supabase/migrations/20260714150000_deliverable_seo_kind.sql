-- Add a 6th deliverable kind, 'seo' (admin-only SEO/AEO starter: per-page meta,
-- keywords, AEO answer, FAQs and JSON-LD, derived from the sitemap). Never
-- published to the client.
alter table public.project_deliverables
  drop constraint if exists project_deliverables_kind_check;
alter table public.project_deliverables
  add constraint project_deliverables_kind_check
  check (kind = any (array['persona','journey','sitemap','copy','brief','seo']));

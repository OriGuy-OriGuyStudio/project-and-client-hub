-- ============================================================
-- "ארגז כלים" deliverables: AI-generated, admin-curated artifacts attached to a
-- project (persona now; journey + sitemap later reuse this table). Drafts are
-- admin-only; a published deliverable is visible to every member of the project's
-- org (via can_access_project) on the client project page.
-- ============================================================

create table if not exists public.project_deliverables (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  org_id      uuid references public.organizations on delete set null,
  kind        text not null check (kind in ('persona', 'journey', 'sitemap')),
  title       text,
  content     jsonb not null default '{}'::jsonb,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists project_deliverables_project_idx on public.project_deliverables (project_id);
create index if not exists project_deliverables_org_idx on public.project_deliverables (org_id);

alter table public.project_deliverables enable row level security;

-- Admin: full access.
create policy "deliverables_admin" on public.project_deliverables
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Client: read PUBLISHED deliverables of projects they can access (org membership).
-- Drafts never leave the admin.
create policy "deliverables_client_read" on public.project_deliverables
  for select to authenticated
  using (status = 'published' and public.can_access_project(project_id));

-- Public bucket for the AI persona portraits. Non-sensitive images shown on the
-- client project page, so public read is fine; writes go through the edge function
-- (service role) or an admin.
insert into storage.buckets (id, name, public)
values ('deliverable-media', 'deliverable-media', true)
on conflict (id) do nothing;

create policy "deliverable_media_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'deliverable-media' and public.is_admin())
  with check (bucket_id = 'deliverable-media' and public.is_admin());

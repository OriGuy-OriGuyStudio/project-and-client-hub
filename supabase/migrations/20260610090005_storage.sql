-- ============================================================
-- 0005 — Private storage bucket + object-level RLS
-- ============================================================
-- Bucket is PRIVATE: files are only ever reachable through signed URLs
-- (minted client-side with the user's JWT, which requires the SELECT policy
-- below). Size (50MB) and MIME allow-list are enforced by Storage itself,
-- server-side — the client mirrors these checks for UX only.
--
-- Path convention: <project_id>/<folder...>/<filename>
-- so the first path segment identifies the owning project.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  52428800, -- 50 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: first path segment -> owning project uuid (null if not a uuid).
create or replace function public.storage_project_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  seg text := (storage.foldername(object_name))[1];
begin
  return seg::uuid;
exception when others then
  return null;
end;
$$;

-- SELECT (also gates signed-URL minting)
create policy "project_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and (public.is_admin() or public.owns_project(public.storage_project_id(name)))
  );

-- INSERT (upload into a project you own, or admin)
create policy "project_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and (public.is_admin() or public.owns_project(public.storage_project_id(name)))
  );

-- UPDATE (re-upload / move within an owned project, or admin)
create policy "project_files_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-files'
    and (public.is_admin() or public.owns_project(public.storage_project_id(name)))
  )
  with check (
    bucket_id = 'project-files'
    and (public.is_admin() or public.owns_project(public.storage_project_id(name)))
  );

-- DELETE (admin, or the project owner)
create policy "project_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and (public.is_admin() or public.owns_project(public.storage_project_id(name)))
  );

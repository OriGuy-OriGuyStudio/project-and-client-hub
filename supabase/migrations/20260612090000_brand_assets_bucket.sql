-- ============================================================
-- 0019 — Public storage bucket for brand assets (logos)
-- ============================================================
-- Bucket is PUBLIC: a client's logo is rendered as a plain <img src=logo_url>
-- on the project page, so it needs a stable, non-expiring URL (unlike the
-- private project-files bucket, which only serves 1-hour signed URLs).
--
-- Only the admin can write; anyone can read (public). Size (5MB) and the
-- image-only MIME allow-list are enforced by Storage itself, server-side —
-- the client mirrors these checks for UX only.
--
-- Path convention: <client_id>/<uuid>-<filename>
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  5242880, -- 5 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- SELECT: public (bucket is public; logos are not sensitive).
create policy "brand_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'brand-assets');

-- INSERT: admin only.
create policy "brand_assets_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-assets' and public.is_admin());

-- UPDATE: admin only.
create policy "brand_assets_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-assets' and public.is_admin())
  with check (bucket_id = 'brand-assets' and public.is_admin());

-- DELETE: admin only.
create policy "brand_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-assets' and public.is_admin());

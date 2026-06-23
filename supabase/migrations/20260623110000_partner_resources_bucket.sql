-- ============================================================
-- 0074 — Public storage bucket for partner sales materials
-- Mirrors brand-assets: public read (materials aren't sensitive), admin-only write.
-- Files are served via stable public URLs stored in partner_resources.file_url.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-resources', 'partner-resources', true, 26214400,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "partner_resources_read" on storage.objects
  for select to public using (bucket_id = 'partner-resources');
create policy "partner_resources_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'partner-resources' and public.is_admin());
create policy "partner_resources_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'partner-resources' and public.is_admin())
  with check (bucket_id = 'partner-resources' and public.is_admin());
create policy "partner_resources_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'partner-resources' and public.is_admin());

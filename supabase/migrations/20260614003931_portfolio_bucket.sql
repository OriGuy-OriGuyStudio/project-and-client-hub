-- ============================================================
-- portfolio_bucket
-- Backfilled from live prod (was applied via MCP, no committed file).
-- Public storage bucket for landing-page portfolio media (videos + images),
-- admin-write / public-read. 25MB limit.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio', 'portfolio', true, 26214400,
  array['video/mp4','video/webm','image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_public_read on storage.objects
  for select to public using (bucket_id = 'portfolio');
create policy portfolio_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'portfolio' and is_admin());
create policy portfolio_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'portfolio' and is_admin()) with check (bucket_id = 'portfolio' and is_admin());
create policy portfolio_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio' and is_admin());

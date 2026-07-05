-- ============================================================
-- 0080 — Guide images: public bucket + images[] on articles/templates
-- ============================================================
-- Screenshots for the site-usage guide are uploaded to a PUBLIC bucket so the
-- client can render them with a plain <img src> (like brand logos). Videos stay
-- as pasted links (Loom/YouTube) via the existing media_url field, since video
-- hosting is heavy. Admin-only writes; anyone can read.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-media',
  'guide-media',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guide_media_public_read" on storage.objects;
create policy "guide_media_public_read" on storage.objects
  for select to public using (bucket_id = 'guide-media');

drop policy if exists "guide_media_admin_insert" on storage.objects;
create policy "guide_media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'guide-media' and public.is_admin());

drop policy if exists "guide_media_admin_update" on storage.objects;
create policy "guide_media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'guide-media' and public.is_admin())
  with check (bucket_id = 'guide-media' and public.is_admin());

drop policy if exists "guide_media_admin_delete" on storage.objects;
create policy "guide_media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'guide-media' and public.is_admin());

-- Uploaded screenshot URLs (public), rendered as a gallery under the article.
alter table public.guide_articles  add column if not exists images text[] not null default '{}';
alter table public.guide_templates add column if not exists images text[] not null default '{}';

-- Keep template -> article copy in sync with the new column.
create or replace function public.apply_guide_template(p_project_id uuid, p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t guide_templates;
  v_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into v_t from guide_templates where id = p_template_id;
  if v_t.id is null then raise exception 'not_found'; end if;

  insert into guide_articles
    (project_id, template_id, title, category, icon, media_url, images, body_html, order_index, created_by, updated_by)
  values
    (p_project_id, v_t.id, v_t.title, v_t.category, v_t.icon, v_t.media_url, v_t.images, v_t.body_html,
     (select coalesce(max(order_index), -1) + 1 from guide_articles where project_id = p_project_id),
     auth.uid(), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

notify pgrst, 'reload schema';

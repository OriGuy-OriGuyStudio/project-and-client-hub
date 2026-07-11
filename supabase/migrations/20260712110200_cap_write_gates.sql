-- ============================================================
-- Phase 2A: capability gates on the client write paths.
-- Members need the matching capability to open a service call, approve, or
-- upload/delete files. View/download stay open (can_access_project). Admin
-- always bypasses. Solo-org managers hold all caps (Phase-1 backfill), so this
-- is behavior-preserving until real limited members exist.
-- ============================================================

-- open_service_call: also require the service_calls capability.
create or replace function public.open_service_call(p_project uuid, p_title text, p_description text default null::text, p_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_name text;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 4000), '');
begin
  if not (public.is_admin() or public.member_can(p_project, 'service_calls')) then
    raise exception 'forbidden';
  end if;
  if v_title = '' then
    raise exception 'empty title';
  end if;

  insert into public.service_calls (project_id, client_id, title, description, attachments, created_by)
  values (p_project, auth.uid(), v_title, v_desc, coalesce(p_attachments, '[]'::jsonb), auth.uid())
  returning id into v_id;

  select coalesce(nullif(btrim(pr.full_name), ''), pr.email) into v_name
  from public.profiles pr where pr.id = auth.uid();

  insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
  values ('admin', null, 'service_call',
    'קריאת שירות חדשה' || coalesce(' מ' || v_name, ''),
    v_title, '/admin/service-calls', p_project, v_id);

  return v_id;
end;
$function$;

-- approvals: client update requires the approve capability.
alter policy approvals_client_update on public.approvals
  using ((select public.member_can(project_id, 'approve')) or is_admin())
  with check ((select public.member_can(project_id, 'approve')) or is_admin());

-- files: upload/delete require the files capability (view/download stay open).
alter policy files_insert on public.files
  with check (is_admin() or ((select public.member_can(project_id, 'files')) and (is_private = false) and (uploaded_by = auth.uid())));
alter policy files_delete on public.files
  using (is_admin() or ((uploaded_by = auth.uid()) and (not is_private) and (select public.member_can(project_id, 'files'))));

-- storage insert/delete require the files capability too (mirror of the table policy).
alter policy project_files_insert on storage.objects
  with check ((bucket_id = 'project-files'::text) and (is_admin() or (select public.member_can(storage_project_id(name), 'files'))));
alter policy project_files_delete on storage.objects
  using ((bucket_id = 'project-files'::text) and (is_admin() or (select public.member_can(storage_project_id(name), 'files'))));

notify pgrst, 'reload schema';

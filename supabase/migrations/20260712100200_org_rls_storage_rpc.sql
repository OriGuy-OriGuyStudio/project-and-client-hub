-- ============================================================
-- Phase 1 parity: storage (file up/download) + client RPCs go through the org.
-- ============================================================
-- The table-RLS swap missed two access layers that also gated on owns_project():
--  1) storage.objects policies (signed-URL file access).
--  2) SECURITY DEFINER RPCs open_service_call + client_service_summary.
-- Without these, a non-owner org member would see file rows but fail to download,
-- and could not open a service call. Behavior-preserving for solo orgs.
-- ============================================================

-- 1) storage.objects — project-files bucket
alter policy project_files_select on storage.objects
  using ((bucket_id = 'project-files'::text) and (is_admin() or (select public.can_access_project(storage_project_id(name)))));
alter policy project_files_insert on storage.objects
  with check ((bucket_id = 'project-files'::text) and (is_admin() or (select public.can_access_project(storage_project_id(name)))));
alter policy project_files_update on storage.objects
  using ((bucket_id = 'project-files'::text) and (is_admin() or (select public.can_access_project(storage_project_id(name)))))
  with check ((bucket_id = 'project-files'::text) and (is_admin() or (select public.can_access_project(storage_project_id(name)))));
alter policy project_files_delete on storage.objects
  using ((bucket_id = 'project-files'::text) and (is_admin() or (select public.can_access_project(storage_project_id(name)))));

-- 2) RPCs — swap owns_project -> can_access_project in the access guard
create or replace function public.open_service_call(p_project uuid, p_title text, p_description text default null::text, p_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_name text;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 4000), '');
begin
  if not (public.is_admin() or public.can_access_project(p_project)) then
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

create or replace function public.client_service_summary(p_project uuid)
returns table(hours_month numeric, hours_total numeric, service_calls_month integer, updates_total integer, backups_total integer, threats_total integer)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not (public.is_admin() or public.can_access_project(p_project)) then
    raise exception 'forbidden';
  end if;
  return query
  with proj as (
    select p_project as id
    union
    select id from public.projects where parent_project_id = p_project and retainer_billed
  ),
  retainer_sessions as (
    select s.duration_seconds, s.started_at
    from public.time_sessions s
    where (s.project_id = p_project and s.is_retainer)
       or s.project_id in (select id from proj where id <> p_project)
  )
  select
    coalesce((select sum(duration_seconds)::numeric / 3600 from retainer_sessions
              where started_at >= date_trunc('month', now())), 0),
    coalesce((select sum(duration_seconds)::numeric / 3600 from retainer_sessions), 0),
    coalesce((select count(*)::int from public.service_calls sc
              where sc.project_id in (select id from proj)
                and sc.created_at >= date_trunc('month', now())), 0)
    + coalesce((select count(*)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind = 'service_call'
                and m.occurred_at >= date_trunc('month', now())), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind in ('update','deploy')), 0),
    coalesce((select sum(m.count)::int from public.maintenance_log m
              where m.project_id in (select id from proj) and m.kind = 'backup'), 0),
    coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm
              where sm.project_id in (select id from proj)), 0);
end;
$function$;

notify pgrst, 'reload schema';

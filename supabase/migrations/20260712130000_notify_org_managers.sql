-- ============================================================
-- Phase 2B-4: fan out client-facing PROJECT notifications to ALL managers of the
-- project's organization, instead of the single projects.client_id. Behavior-
-- preserving for solo orgs (the client is the sole manager). Per-user paths
-- (feedback reply, referral/credits redemptions, coins) intentionally stay
-- targeted at the specific user and are NOT changed here.
-- ============================================================

-- shared helper: one client-audience notification per manager of the project's org.
create or replace function public.notify_org_managers(
  p_project uuid, p_type text, p_title text, p_body text, p_link text, p_entity_id uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select org_id into v_org from public.projects where id = p_project;
  if v_org is null then return; end if;
  insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
  select 'client', m.user_id, p_type, p_title, p_body, p_link, p_project, p_entity_id
  from public.organization_members m where m.org_id = v_org and m.is_manager;
end; $function$;
grant execute on function public.notify_org_managers(uuid,text,text,text,text,uuid) to authenticated;

-- admin opens a service call for a project -> notify the org's managers.
create or replace function public.admin_open_service_call(p_project uuid, p_title text, p_description text default null::text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid; v_client uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 4000), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_title = '' then raise exception 'empty title'; end if;
  select client_id into v_client from public.projects where id = p_project;
  insert into public.service_calls (project_id, client_id, title, description, created_by)
  values (p_project, v_client, v_title, v_desc, auth.uid())
  returning id into v_id;
  perform public.notify_org_managers(p_project, 'service_call', 'הסטודיו פתח עבורך קריאת שירות', v_title, '/service', v_id);
  return v_id;
end; $function$;

-- service-call status change -> fan out to the org's managers (was: new.client_id).
create or replace function public.notify_service_call_status()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_org uuid;
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('in_progress', 'done')
     and new.project_id is not null then
    select org_id into v_org from public.projects where id = new.project_id;
    if v_org is not null then
      insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
      select 'client', m.user_id, 'service_call_status',
        case when new.status = 'done' then 'קריאת השירות שלך טופלה' else 'קריאת השירות שלך בטיפול' end,
        case when new.status = 'done'
             then 'הקריאה "' || new.title || '" סומנה כטופלה.'
             else 'התחלנו לטפל בקריאה "' || new.title || '".' end,
        '/service', new.project_id, new.id
      from public.organization_members m where m.org_id = v_org and m.is_manager;
    end if;
  end if;
  return new;
end; $function$;

notify pgrst, 'reload schema';

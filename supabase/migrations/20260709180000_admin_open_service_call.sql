-- ============================================================
-- 0092 — admin can open a service call on a client's behalf (proactive)
-- ============================================================
-- When the studio finds something itself, it opens a real service_calls row for
-- the client: it shows in /admin/service-calls, in the client's "הקריאות שלך"
-- (tagged as studio-opened, since created_by <> client_id), and the client gets
-- an in-app notification.
-- ============================================================

create or replace function public.admin_open_service_call(
  p_project uuid,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_client uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_desc text := nullif(left(btrim(coalesce(p_description, '')), 4000), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if v_title = '' then
    raise exception 'empty title';
  end if;

  select client_id into v_client from public.projects where id = p_project;

  insert into public.service_calls (project_id, client_id, title, description, created_by)
  values (p_project, v_client, v_title, v_desc, auth.uid())
  returning id into v_id;

  if v_client is not null then
    insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
    values ('client', v_client, 'service_call', 'הסטודיו פתח עבורך קריאת שירות', v_title, '/service', p_project, v_id);
  end if;

  return v_id;
end;
$$;

grant execute on function public.admin_open_service_call(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

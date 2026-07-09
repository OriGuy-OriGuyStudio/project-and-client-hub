-- ============================================================
-- 0089 — client-opened service calls
-- ============================================================
-- Clients can't write to maintenance_log directly (RLS is read-only for them).
-- open_service_call() is a SECURITY DEFINER RPC that lets a client (or admin)
-- who owns the project open a "קריאת שירות": it logs the call to maintenance_log
-- (so it shows on "השירות שלך" and bumps the service-calls counter) and drops an
-- in-app notification to the studio (admin bell).
-- ============================================================

create or replace function public.open_service_call(p_project uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_msg text := left(btrim(coalesce(p_message, '')), 1000);
begin
  if not (public.is_admin() or public.owns_project(p_project)) then
    raise exception 'forbidden';
  end if;
  if v_msg = '' then
    raise exception 'empty message';
  end if;

  insert into public.maintenance_log (project_id, kind, title, meta)
  values (
    p_project,
    'service_call',
    left(v_msg, 120),
    jsonb_build_object('body', v_msg, 'source', 'client')
  )
  returning id into v_id;

  select coalesce(nullif(btrim(pr.full_name), ''), pr.email)
    into v_name
  from public.profiles pr
  where pr.id = auth.uid();

  insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
  values (
    'admin',
    null,
    'service_call',
    'קריאת שירות חדשה' || coalesce(' מ' || v_name, ''),
    v_msg,
    '/projects/' || p_project::text,
    p_project,
    v_id
  );

  return v_id;
end;
$$;

grant execute on function public.open_service_call(uuid, text) to authenticated;

notify pgrst, 'reload schema';

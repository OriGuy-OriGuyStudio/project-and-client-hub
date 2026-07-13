-- Expose a project's discovery-call summary share token to the people who can
-- see the project. discovery_sessions is admin-only at the RLS level, so a client
-- (org member) can't read share_token directly; this SECURITY DEFINER RPC returns
-- it (only when a shareable summary exists) so the client project page can link to
-- the public summary at /discovery/<token>. Falls back from a session linked to
-- the project to the latest session of the project's org.
create or replace function public.get_project_discovery_share(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_title text;
  v_org uuid;
begin
  if not (public.is_admin() or public.can_access_project(p_project_id)) then
    return null;
  end if;

  select share_token, title into v_token, v_title
    from public.discovery_sessions
    where project_id = p_project_id and share_token is not null
    order by updated_at desc limit 1;

  if v_token is null then
    select org_id into v_org from public.projects where id = p_project_id;
    if v_org is not null then
      select share_token, title into v_token, v_title
        from public.discovery_sessions
        where org_id = v_org and share_token is not null
        order by updated_at desc limit 1;
    end if;
  end if;

  if v_token is null then return null; end if;
  return jsonb_build_object('token', v_token, 'title', v_title);
end;
$$;

revoke all on function public.get_project_discovery_share(uuid) from public, anon;
grant execute on function public.get_project_discovery_share(uuid) to authenticated;

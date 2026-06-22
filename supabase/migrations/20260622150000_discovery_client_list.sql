-- ============================================================
-- 0069 — Client-facing list of their own discovery summaries
-- The discovery_sessions table stays admin-only (RLS unchanged). A signed-in
-- client reads ONLY their own *completed* sessions through this definer RPC,
-- which returns just the share_token (to open the existing public summary page)
-- plus list metadata. Drafts and internal fields are never exposed.
-- ============================================================

create or replace function public.get_my_discovery_sessions()
returns table (
  id           uuid,
  title        text,
  template_key text,
  share_token  text,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, title, template_key, share_token, created_at
  from public.discovery_sessions
  where client_id = auth.uid()
    and status = 'done'
  order by created_at desc;
$$;

grant execute on function public.get_my_discovery_sessions() to authenticated;

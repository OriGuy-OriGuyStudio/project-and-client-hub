-- ============================================================
-- 0082 — admin_user_activity() also folds in usage_events
-- ============================================================
-- "Last activity" on the Clients/Partners cards reads admin_user_activity(),
-- which previously returned only greatest(auth.last_sign_in_at, last_seen_at).
-- The Analytics page separately folded in usage_events, so the two could
-- disagree (a user active via tracked navigation but whose last_seen hadn't
-- updated showed stale on Partners/Clients). Fold usage_events into the RPC so
-- every surface reads one accurate "last activity".
-- ============================================================

create or replace function public.admin_user_activity()
returns table (id uuid, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.id,
           greatest(u.last_sign_in_at, p.last_seen_at, ue.last_event) as last_sign_in_at,
           u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join (select user_id, max(created_at) as last_event from public.usage_events group by user_id) ue
      on ue.user_id = u.id;
end;
$$;

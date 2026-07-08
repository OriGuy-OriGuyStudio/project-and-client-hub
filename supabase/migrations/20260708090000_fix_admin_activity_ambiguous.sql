-- ============================================================
-- 0083 — fix admin_user_activity(): "created_at" was ambiguous
-- ============================================================
-- 0082 rewrote admin_user_activity() to fold in usage_events, but its subquery
-- `max(created_at) from usage_events` collided with the function's OUT column
-- also named `created_at` (from RETURNS TABLE). PL/pgSQL raised
--   42702: column reference "created_at" is ambiguous
-- on every call, so the RPC threw and the Clients/Partners pages (which ignore
-- the error) showed *everyone* as "טרם נכנס". Qualify every column with its
-- table alias so nothing collides with the OUT parameters.
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
    left join (
      select uev.user_id, max(uev.created_at) as last_event
      from public.usage_events uev
      group by uev.user_id
    ) ue on ue.user_id = u.id;
end;
$$;

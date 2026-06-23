-- ============================================================
-- 0075 — Real "last activity" (not just last sign-in)
-- auth.users.last_sign_in_at only updates on a fresh authentication, so a user
-- with a persisted session (good UX, no constant re-login) looked stale. Track a
-- real heartbeat: the app calls touch_last_seen() on every load with a session.
-- admin_user_activity() now returns the greater of the two.
-- ============================================================

alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;

create or replace function public.admin_user_activity()
returns table (id uuid, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select u.id,
           greatest(u.last_sign_in_at, p.last_seen_at) as last_sign_in_at,
           u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id;
end;
$$;

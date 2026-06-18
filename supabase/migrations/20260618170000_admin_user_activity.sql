-- ============================================================
-- 0054 — Reliable last-login for analytics + client list (admin)
-- The analytics "last seen / dormant" was derived from usage_events, which can
-- miss a login (a partner who signed in showed as "never logged in"). The
-- authoritative signal is auth.users.last_sign_in_at, maintained by Supabase on
-- every sign-in. Expose it to the admin via a definer RPC.
-- ============================================================

create or replace function public.admin_user_activity()
returns table (id uuid, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query select u.id, u.last_sign_in_at, u.created_at from auth.users u;
end;
$$;

revoke execute on function public.admin_user_activity() from anon;
grant execute on function public.admin_user_activity() to authenticated;
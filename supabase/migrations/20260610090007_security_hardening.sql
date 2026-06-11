-- ============================================================
-- 0007 — Security hardening (from advisor review)
-- ============================================================

-- get_client_credits must not leak another client's total: only the owner
-- (or an admin) gets a real sum; everyone else gets 0.
create or replace function public.get_client_credits(p_client_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select case
    when p_client_id = auth.uid() or public.is_admin()
      then coalesce((select sum(amount) from public.credit_transactions where client_id = p_client_id), 0)::int
    else 0
  end;
$$;

-- Pin search_path on the two functions the linter flagged.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.storage_project_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  seg text := (storage.foldername(object_name))[1];
begin
  return seg::uuid;
exception when others then
  return null;
end;
$$;

-- Trigger functions never need to be REST-RPC callable (triggers still fire).
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.enforce_profile_role() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;

-- RLS helpers only need to run for signed-in users, not anon.
revoke execute on function public.get_my_role() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.owns_project(uuid) from anon;
revoke execute on function public.get_client_credits(uuid) from anon;

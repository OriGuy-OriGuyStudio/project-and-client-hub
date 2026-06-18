-- ============================================================
-- 0051 — Email magic-link: whitelist pre-check + notify admin on attempt
-- With Google OAuth, an unknown account only reaches the access-denied screen
-- after returning. For email magic-link we don't want to waste a send (or let
-- a junk address "proceed") — so the client first asks whether the email is
-- whitelisted. If not, we DON'T send a link, and we notify the admin that
-- someone tried (deduped to once/hour per address to avoid spam).
-- ============================================================

create or replace function public.request_email_login(p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ok    boolean;
begin
  if not public.is_email_addr(v_email) then
    return json_build_object('authorized', false, 'error', 'invalid');
  end if;

  v_ok := exists (select 1 from public.allowed_emails where lower(email) = v_email);

  if not v_ok then
    -- Notify the admin, but at most once per hour per address.
    if not exists (
      select 1 from public.notifications
      where type = 'login_attempt' and body = v_email and created_at > now() - interval '1 hour'
    ) then
      perform public.notify_admin('login_attempt', 'ניסיון כניסה עם מייל לא מורשה', v_email, null, null, null);
    end if;
  end if;

  return json_build_object('authorized', v_ok);
end;
$$;

revoke execute on function public.request_email_login(text) from anon;
grant execute on function public.request_email_login(text) to anon, authenticated;

-- Opening the referral program for a client used to be silent: a row landed in
-- partner_enrollments and the client found out only if they happened to notice
-- a new menu item. Now approval sends them a welcome email (what they get, how
-- to refer, link to the program) plus an in-portal notification, and the admin
-- can re-send it on demand.
--
-- Revoking stays silent on purpose , nobody needs an email about a benefit
-- being taken away.

-- Shared by the trigger and the manual resend so the two can never drift.
create or replace function public.send_referral_welcome(p_client_id uuid, p_resent boolean default false)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  if p_client_id is null then
    return;
  end if;

  select value into v_secret from public.webhook_secrets where name = 'lead_notify';

  -- Fire-and-forget: a mail failure must never block the enrollment itself.
  perform net.http_post(
    url := 'https://tirasinbjsotcrqggipe.supabase.co/functions/v1/notify-referral-approved',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('client_id', p_client_id, 'resent', p_resent)
  );

  -- In-portal notification, so it also lands for a client who never opens mail.
  -- Only on the first approval: a resend is a nudge by email, not a new event.
  if not p_resent then
    insert into public.notifications (audience, recipient_id, type, title, body, link)
    values (
      'client',
      p_client_id,
      'gift',
      'תוכנית ההפניות נפתחה לך',
      'על כל הפניה שנסגרת נכנסים אליך 5% מהעסקה כקרדיט אצלי.',
      '/partner'
    );
  end if;
end;
$$;

create or replace function public.on_partner_enrollment_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.send_referral_welcome(NEW.client_id, false);
  return NEW;
end;
$$;

drop trigger if exists trg_referral_welcome on public.partner_enrollments;
create trigger trg_referral_welcome
  after insert on public.partner_enrollments
  for each row execute function public.on_partner_enrollment_created();

-- The admin "שלח שוב" button. Admin-only, and only for a client who really is
-- enrolled, so the button can never mail someone the program wasn't opened for.
create or replace function public.resend_referral_welcome(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.partner_enrollments where client_id = p_client_id) then
    return jsonb_build_object('ok', false, 'error', 'not_enrolled');
  end if;

  perform public.send_referral_welcome(p_client_id, true);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.resend_referral_welcome(uuid) from public, anon;
grant execute on function public.resend_referral_welcome(uuid) to authenticated;

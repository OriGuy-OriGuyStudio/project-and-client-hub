-- Email the REFERRER (partner or client) whenever a lead they sent moves to a
-- new stage. Mirrors the notify-lead pattern: a trigger calls the
-- `notify-lead-status` Edge Function via pg_net with the shared `lead_notify`
-- secret, fire-and-forget so a mail failure never blocks the status update.
-- Fires only when status ACTUALLY changed (`is distinct from`), so unrelated
-- edits (deal value, payment confirmation) stay silent.

create or replace function public.notify_lead_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_referrer uuid;
  v_name text;
  v_audience text;
begin
  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  -- One trigger function for both lead tables; the column names differ.
  if TG_TABLE_NAME = 'partner_leads' then
    v_referrer := NEW.partner_id;
    v_name := NEW.lead_name;
    v_audience := 'partner';
  else
    v_referrer := NEW.referrer_id;
    v_name := NEW.referred_name;
    v_audience := 'client';
  end if;

  if v_referrer is null then
    return NEW;
  end if;

  select value into v_secret from public.webhook_secrets where name = 'lead_notify';

  perform net.http_post(
    url := 'https://tirasinbjsotcrqggipe.supabase.co/functions/v1/notify-lead-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'referrer_id', v_referrer,
      'status', NEW.status,
      'lead_name', v_name,
      'audience', v_audience
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_lead_status on public.partner_leads;
create trigger trg_notify_lead_status
  after update of status on public.partner_leads
  for each row execute function public.notify_lead_status_changed();

drop trigger if exists trg_notify_referral_status on public.referrals;
create trigger trg_notify_referral_status
  after update of status on public.referrals
  for each row execute function public.notify_lead_status_changed();

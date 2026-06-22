-- ============================================================
-- 0070 — Server-side admin email on every new partner lead (never miss a lead)
-- A trigger on partner_leads calls the `notify-lead` Edge Function via pg_net, so
-- the studio is emailed for EVERY lead regardless of path (partner portal, public
-- referral landing, or admin-added) and regardless of any client-side failure.
-- The function authenticates with a shared secret stored in `webhook_secrets`.
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- Shared secrets for DB-to-Edge-Function calls. RLS on with NO policies, so only
-- the service role (Edge Functions) and SECURITY DEFINER functions read it.
create table if not exists public.webhook_secrets (
  name  text primary key,
  value text not null
);
alter table public.webhook_secrets enable row level security;

insert into public.webhook_secrets (name, value)
values ('lead_notify', replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.notify_lead_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.webhook_secrets where name = 'lead_notify';
  -- Fire-and-forget: pg_net queues the request, so a failure never blocks the insert.
  perform net.http_post(
    url := 'https://tirasinbjsotcrqggipe.supabase.co/functions/v1/notify-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'lead_name', NEW.lead_name,
      'lead_phone', NEW.lead_phone,
      'lead_email', NEW.lead_email,
      'project_type', NEW.project_type,
      'notes', NEW.notes,
      'quote_requested', NEW.quote_requested,
      'partner_id', NEW.partner_id
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_lead on public.partner_leads;
create trigger trg_notify_lead
  after insert on public.partner_leads
  for each row execute function public.notify_lead_inserted();

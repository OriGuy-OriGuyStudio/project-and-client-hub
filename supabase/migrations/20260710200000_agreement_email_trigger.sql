-- ============================================================
-- 0099 — Server-side studio email on every new service agreement
-- ============================================================
-- A trigger on service_agreements calls the `notify-agreement` Edge Function via
-- pg_net, so the studio is emailed for EVERY approval regardless of path or any
-- client-side failure. Authenticated by a shared secret in webhook_secrets.
--
-- The function base URL is read from webhook_secrets (name 'functions_base_url')
-- so a branch can point at its own functions for QA without editing this file;
-- it defaults to the production project.
-- ============================================================

create extension if not exists pg_net with schema extensions;

insert into public.webhook_secrets (name, value)
values ('agreement_notify', replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

insert into public.webhook_secrets (name, value)
values ('functions_base_url', 'https://tirasinbjsotcrqggipe.supabase.co')
on conflict (name) do nothing;

create or replace function public.notify_agreement_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_base   text;
begin
  select value into v_secret from public.webhook_secrets where name = 'agreement_notify';
  select value into v_base   from public.webhook_secrets where name = 'functions_base_url';
  -- Fire-and-forget: pg_net queues the request, so a failure never blocks the insert.
  perform net.http_post(
    url := coalesce(v_base, 'https://tirasinbjsotcrqggipe.supabase.co') || '/functions/v1/notify-agreement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'full_name', NEW.full_name,
      'business', NEW.business,
      'email', NEW.email,
      'phone', NEW.phone,
      'tier_name', coalesce(NEW.terms_snapshot->>'tier_name', NEW.tier),
      'site_type_label', coalesce(NEW.terms_snapshot->>'site_type_label', NEW.site_type),
      'monthly_price', NEW.monthly_price,
      'billing_cycle', NEW.billing_cycle,
      'access_token', NEW.access_token,
      'client_id', NEW.client_id
    )
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_agreement on public.service_agreements;
create trigger trg_notify_agreement
  after insert on public.service_agreements
  for each row execute function public.notify_agreement_inserted();

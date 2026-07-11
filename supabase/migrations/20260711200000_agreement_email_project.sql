-- ============================================================
-- 0105 — include the project to assign in the approval email
-- ============================================================
-- The studio email (notify-agreement) didn't say which project the package is
-- for. Pass project_id + project_title so Ori knows exactly where to assign it.
-- ============================================================

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
      'client_id', NEW.client_id,
      'project_id', NEW.project_id,
      'project_title', (select title from public.projects where id = NEW.project_id)
    )
  );
  return NEW;
end;
$$;

-- trigger already exists (from 0099); the function is replaced in place.

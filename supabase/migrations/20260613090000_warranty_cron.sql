-- ============================================================
-- 0020 — Warranty-reminder schedule (pg_cron + pg_net + Vault)
-- ============================================================
-- Daily job that invokes the `warranty-reminder` Edge Function, which emails
-- each client 7 days before their project's 30-day warranty ends (once), drops
-- an in-app notification, and CCs the studio. See
-- supabase/functions/warranty-reminder/index.ts.
--
-- Auth: the function checks `Authorization: Bearer <CRON_SECRET>`. We generate a
-- random secret and keep it in Vault (NO literal in this file). The cron command
-- reads it from Vault; the function reads the SAME value from its `CRON_SECRET`
-- env secret (set manually in the Supabase dashboard, alongside RESEND_API_KEY).
-- Until those env secrets are set the function fails closed (401 / no-op) and
-- nothing is sent — harmless.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Generate + store the shared secret once (random; per-DB). Idempotent.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'warranty_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(24), 'hex'),
      'warranty_cron_secret',
      'Bearer token pg_cron sends to the warranty-reminder edge function'
    );
  end if;
end $$;

-- Daily at 06:00 UTC (~09:00 Israel). cron.schedule upserts by name.
select cron.schedule(
  'warranty-reminder-daily',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://tirasinbjsotcrqggipe.supabase.co/functions/v1/warranty-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'warranty_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

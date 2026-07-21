-- Admin-invoked "send the addendum sign link to the client by email". Mirrors
-- resend_referral_welcome: admin-gated, fires the notify-addendum edge function
-- via pg_net with the shared secret, fire-and-forget so a mail hiccup never
-- blocks the admin action.
create or replace function public.admin_send_addendum(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_secret text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.agreement_addenda where id = p_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select value into v_secret from public.webhook_secrets where name = 'lead_notify';
  perform net.http_post(
    url := 'https://tirasinbjsotcrqggipe.supabase.co/functions/v1/notify-addendum',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
    body := jsonb_build_object('addendum_id', p_id)
  );
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.admin_send_addendum(uuid) from public, anon;
grant execute on function public.admin_send_addendum(uuid) to authenticated;

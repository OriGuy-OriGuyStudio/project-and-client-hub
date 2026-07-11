-- ============================================================
-- 0101 — Package activation + client welcome celebration
-- ============================================================
-- After a client signs, Ori sets up the infrastructure (WAF, backups,
-- monitoring). When it's all live he marks the package "activated". That:
--   1. stamps project_service.activated_at (shown as a live badge in admin),
--   2. fires a marketing welcome email to the client (edge fn, via pg_net),
--   3. arms a one-time celebration popup in the client's Orion (shown until
--      the client dismisses it → welcome_seen_at).
-- ============================================================

alter table public.project_service add column if not exists activated_at    timestamptz;
alter table public.project_service add column if not exists welcome_seen_at timestamptz;

-- Shared secret for the welcome mailer (mirrors agreement_notify).
insert into public.webhook_secrets (name, value)
values ('service_welcome_notify', replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- Admin: mark the package as fully set up + live. Idempotent (won't re-fire the
-- email if already activated).
create or replace function public.activate_service(p_project uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare v_row public.project_service;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.project_service
     set activated_at = coalesce(activated_at, now())
   where project_id = p_project and active = true
   returning * into v_row;
  if v_row.project_id is null then
    raise exception 'no active service for project %', p_project;
  end if;
  return json_build_object('ok', true, 'activated_at', v_row.activated_at);
end $$;
grant execute on function public.activate_service(uuid) to authenticated;

-- Client: dismiss the celebration popup (once).
create or replace function public.ack_service_welcome(p_project uuid)
returns json
language plpgsql security definer set search_path = public as $$
begin
  update public.project_service ps
     set welcome_seen_at = now()
   where ps.project_id = p_project
     and ps.welcome_seen_at is null
     and exists (select 1 from public.projects pr
                 where pr.id = p_project and pr.client_id = auth.uid());
  return json_build_object('ok', true);
end $$;
grant execute on function public.ack_service_welcome(uuid) to authenticated;

-- On activation (null -> set), email the client. Fire-and-forget via pg_net so a
-- mail failure never blocks the update.
create or replace function public.notify_service_activated()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_secret text; v_base text;
begin
  if NEW.activated_at is not null and OLD.activated_at is null then
    select value into v_secret from public.webhook_secrets where name = 'service_welcome_notify';
    select value into v_base   from public.webhook_secrets where name = 'functions_base_url';
    perform net.http_post(
      url := coalesce(v_base, 'https://tirasinbjsotcrqggipe.supabase.co') || '/functions/v1/notify-service-welcome',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
      body := jsonb_build_object('project_id', NEW.project_id, 'tier', NEW.tier, 'monthly_price', NEW.monthly_price)
    );
  end if;
  return NEW;
end $$;

drop trigger if exists trg_notify_service_activated on public.project_service;
create trigger trg_notify_service_activated
  after update on public.project_service
  for each row execute function public.notify_service_activated();

-- Expose activated_at in the admin overview so the tab can show a live badge +
-- an "activate" action.
create or replace function public.admin_maintenance_overview()
returns table (
  project_id uuid, project_title text, client_name text, client_email text,
  tier text, site_type text, site_url text, hourly_rate numeric, monthly_price numeric,
  preview_token text,
  pagespeed int, uptime_pct numeric, threats_blocked int, lcp_ms int, last_metric_date date,
  hours_month numeric, open_calls int, activated_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select
    p.id, p.title, coalesce(nullif(btrim(pr.full_name), ''), pr.email), pr.email,
    ps.tier, ps.site_type, ps.site_url, ps.hourly_rate, ps.monthly_price,
    ps.preview_token,
    sm.pagespeed, sm.uptime_pct, sm.threats_blocked, sm.lcp_ms, sm.metric_date,
    coalesce((
      select sum(s.duration_seconds)::numeric / 3600 from public.time_sessions s
      where s.started_at >= date_trunc('month', now())
        and ((s.project_id = p.id and s.is_retainer)
             or s.project_id in (select c.id from public.projects c
                                 where c.parent_project_id = p.id and c.retainer_billed))
    ), 0),
    coalesce((select count(*)::int from public.service_calls sc
              where sc.project_id = p.id and sc.status in ('new','scheduled','in_progress')), 0),
    ps.activated_at
  from public.project_service ps
  join public.projects p on p.id = ps.project_id
  left join public.profiles pr on pr.id = p.client_id
  left join lateral (
    select m.pagespeed, m.uptime_pct, m.threats_blocked, m.lcp_ms, m.metric_date
    from public.site_metrics m where m.project_id = p.id
    order by m.metric_date desc limit 1
  ) sm on true
  where ps.active
  order by pr.full_name, p.title;
end;
$$;

notify pgrst, 'reload schema';

-- ============================================================
-- Phase 2A hardening (post-final-review): close two residuals so a limited
-- member (Phase 2B) is safe.
-- (1) Option B for the price/ROI money residual: RLS is row-level and cannot
--     hide a column; a per-project capability cannot be expressed as a column
--     privilege (everyone is the `authenticated` role); and a per-cap
--     security-barrier view cannot both hide the column AND preserve base-table
--     RLS. So the correct closure is to MOVE the money into a finance-gated
--     companion table. project_service SELECT stays open to members for the
--     non-money fields (tier, site_type, metrics); monthly_price/hourly_rate are
--     now readable only by admin or a can_finance member.
-- (2) Gate the two files-capability write paths that 2A-3 left on
--     can_access_project: project_folders insert/delete and storage UPDATE.
-- ============================================================

-- (1) finance-gated money companion table ------------------------------------
create table if not exists public.project_service_money (
  project_id uuid primary key references public.projects(id) on delete cascade,
  monthly_price numeric,
  hourly_rate numeric
);

-- preserve existing values before dropping the source columns.
insert into public.project_service_money (project_id, monthly_price, hourly_rate)
  select project_id, monthly_price, hourly_rate from public.project_service
  on conflict (project_id) do nothing;

alter table public.project_service_money enable row level security;

drop policy if exists psm_read on public.project_service_money;
create policy psm_read on public.project_service_money
  for select to authenticated
  using (public.is_admin() or (select public.member_can(project_id, 'finance')));

drop policy if exists psm_admin_write on public.project_service_money;
create policy psm_admin_write on public.project_service_money
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- repoint the two SECURITY DEFINER readers to the money table.
create or replace function public.client_service_money(p_project uuid)
returns table(monthly_price numeric, hourly_rate numeric)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not (public.is_admin() or public.member_can(p_project, 'finance')) then
    raise exception 'forbidden';
  end if;
  return query
    select m.monthly_price, m.hourly_rate
    from public.project_service_money m
    where m.project_id = p_project;
end;
$function$;

create or replace function public.admin_maintenance_overview()
returns table(project_id uuid, project_title text, client_name text, client_email text, tier text, site_type text, site_url text, hourly_rate numeric, monthly_price numeric, preview_token text, pagespeed integer, uptime_pct numeric, threats_blocked integer, lcp_ms integer, last_metric_date date, hours_month numeric, open_calls integer, activated_at timestamp with time zone)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select
    p.id, p.title, coalesce(nullif(btrim(pr.full_name), ''), pr.email), pr.email,
    ps.tier, ps.site_type, ps.site_url, m.hourly_rate, m.monthly_price,
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
  left join public.project_service_money m on m.project_id = ps.project_id
  left join public.profiles pr on pr.id = p.client_id
  left join lateral (
    select mt.pagespeed, mt.uptime_pct, mt.threats_blocked, mt.lcp_ms, mt.metric_date
    from public.site_metrics mt where mt.project_id = p.id
    order by mt.metric_date desc limit 1
  ) sm on true
  where ps.active
  order by pr.full_name, p.title;
end;
$function$;

-- notify_service_activated (activation-welcome trigger, migration
-- 20260711120000) put NEW.monthly_price in its webhook payload. The
-- notify-service-welcome edge function never reads it, so drop it from the
-- payload — otherwise the trigger errors ("record new has no field
-- monthly_price") on the next project_service UPDATE once the column is gone.
create or replace function public.notify_service_activated()
returns trigger language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare v_secret text; v_base text;
begin
  if NEW.activated_at is not null and OLD.activated_at is null then
    select value into v_secret from public.webhook_secrets where name = 'service_welcome_notify';
    select value into v_base   from public.webhook_secrets where name = 'functions_base_url';
    perform net.http_post(
      url := coalesce(v_base, 'https://tirasinbjsotcrqggipe.supabase.co') || '/functions/v1/notify-service-welcome',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
      body := jsonb_build_object('project_id', NEW.project_id, 'tier', NEW.tier)
    );
  end if;
  return NEW;
end $function$;

-- money is now read only through the two definers above; drop the source columns
-- so a non-finance member can no longer read them off project_service directly.
alter table public.project_service drop column monthly_price, drop column hourly_rate;

-- service_preview (tokenized public report/preview, definer) built the `service`
-- object from to_jsonb(project_service.*), which used to carry the money. Re-merge
-- it from the money table so the client's report keeps showing the real price/rate
-- (the share token is the authorization here, so exposing it is intentional).
create or replace function public.service_preview(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_proj uuid; v_result jsonb;
begin
  select project_id into v_proj from public.project_service where preview_token = p_token and active;
  if v_proj is null then return null; end if;
  select jsonb_build_object(
    'service', to_jsonb(ps.*) || jsonb_build_object('monthly_price', mo.monthly_price, 'hourly_rate', mo.hourly_rate),
    'project_title', p.title,
    'business_name', coalesce(nullif(btrim(cb.business_name), ''), p.title),
    'metrics', coalesce((select jsonb_agg(to_jsonb(m.*) order by m.metric_date desc)
      from public.site_metrics m where m.project_id = v_proj), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(to_jsonb(l.*) order by l.occurred_at desc)
      from public.maintenance_log l where l.project_id = v_proj), '[]'::jsonb),
    'summary', (
      with proj as (
        select v_proj as id
        union
        select id from public.projects where parent_project_id = v_proj and retainer_billed
      ),
      rs as (
        select s.duration_seconds, s.started_at from public.time_sessions s
        where (s.project_id = v_proj and s.is_retainer)
           or s.project_id in (select id from proj where id <> v_proj)
      )
      select jsonb_build_object(
        'hours_month', coalesce((select sum(duration_seconds)::numeric/3600 from rs where started_at >= date_trunc('month', now())), 0),
        'hours_total', coalesce((select sum(duration_seconds)::numeric/3600 from rs), 0),
        'service_calls_month',
          coalesce((select count(*)::int from public.service_calls sc where sc.project_id in (select id from proj) and sc.created_at >= date_trunc('month', now())), 0)
          + coalesce((select count(*)::int from public.maintenance_log m where m.project_id in (select id from proj) and m.kind='service_call' and m.occurred_at >= date_trunc('month', now())), 0),
        'updates_total', coalesce((select sum(m.count)::int from public.maintenance_log m where m.project_id in (select id from proj) and m.kind in ('update','deploy')), 0),
        'backups_total', coalesce((select sum(m.count)::int from public.maintenance_log m where m.project_id in (select id from proj) and m.kind='backup'), 0),
        'threats_total', coalesce((select sum(sm.threats_blocked)::int from public.site_metrics sm where sm.project_id in (select id from proj)), 0)
      )
    )
  ) into v_result
  from public.project_service ps
  join public.projects p on p.id = ps.project_id
  left join public.project_service_money mo on mo.project_id = ps.project_id
  left join public.client_brand cb on cb.client_id = p.client_id
  where ps.project_id = v_proj;
  return v_result;
end;
$function$;

-- (2) files-capability gates 2A-3 left open ----------------------------------
-- folders: create requires files + own; delete requires files (kept the prior
-- "any member with the cap" delete scope; the client UI additionally limits it
-- to the folder's creator).
alter policy project_folders_insert on public.project_folders
  with check (is_admin() or ((select public.member_can(project_id, 'files')) and (created_by = auth.uid())));
alter policy project_folders_delete on public.project_folders
  using (is_admin() or (select public.member_can(project_id, 'files')));

-- storage object UPDATE (overwrite) requires the files capability too, matching
-- insert/delete (2A-3 re-gated only insert/delete).
alter policy project_files_update on storage.objects
  using ((bucket_id = 'project-files'::text) and (is_admin() or (select public.member_can(storage_project_id(name), 'files'))))
  with check ((bucket_id = 'project-files'::text) and (is_admin() or (select public.member_can(storage_project_id(name), 'files'))));

notify pgrst, 'reload schema';

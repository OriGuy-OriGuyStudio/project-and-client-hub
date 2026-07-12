-- Org-centric admin (task 7): move brand ownership from per-client to per-org.
-- Only the founding member's client_brand row stays canonical (is_org_primary);
-- any other brand rows are archived (reversible via client_brand_archive) then
-- removed. Gate (task 6) confirmed 0 non-founding members hold real brand data
-- on this branch, so the archive/delete below is safe.

-- is_org_primary must be added BEFORE the archive table is created (the LIKE
-- below snapshots client_brand's column list at creation time; if the archive
-- table were created first, "select cb.*, now()" further down would carry one
-- more column than the archive table has and the INSERT would fail).
alter table public.client_brand add column if not exists is_org_primary boolean not null default false;

create table if not exists public.client_brand_archive (like public.client_brand including all);
alter table public.client_brand_archive add column if not exists archived_at timestamptz not null default now();

-- hardening beyond the brief: "like ... including all" does not copy row-level
-- security, and this DB grants broad table privileges to anon/authenticated by
-- default (RLS is the real gate) - every other log/archive table in this schema
-- (activity_log, client_call_logs, maintenance_log) has RLS enabled, so this one
-- must too. Admin-only: it's cross-tenant audit data, not client-scoped.
alter table public.client_brand_archive enable row level security;
drop policy if exists client_brand_archive_admin_only on public.client_brand_archive;
create policy client_brand_archive_admin_only on public.client_brand_archive
  for all using (is_admin()) with check (is_admin());

with founder as (
  select distinct on (m.org_id) m.org_id, m.user_id from public.organization_members m
  order by m.org_id, m.created_at, m.user_id
)
update public.client_brand cb set is_org_primary = true
from founder f where cb.org_id = f.org_id and cb.client_id = f.user_id;

-- archive + remove the non-primary brand rows (reversible via client_brand_archive).
with founder as (
  select distinct on (m.org_id) m.org_id, m.user_id from public.organization_members m
  order by m.org_id, m.created_at, m.user_id
)
insert into public.client_brand_archive
  select cb.*, now() from public.client_brand cb join founder f on f.org_id=cb.org_id
  where cb.client_id <> f.user_id;
with founder as (
  select distinct on (m.org_id) m.org_id, m.user_id from public.organization_members m
  order by m.org_id, m.created_at, m.user_id
)
delete from public.client_brand cb using founder f
  where cb.org_id=f.org_id and cb.client_id <> f.user_id;

-- org brand read helper (definer): the org's single primary brand.
create or replace function public.org_brand(p_org uuid)
returns public.client_brand language sql stable security definer set search_path to 'public' as $function$
  select * from public.client_brand where org_id = p_org and is_org_primary limit 1;
$function$;
grant execute on function public.org_brand(uuid) to authenticated;

-- fold-in A: brand_colors_select had no org path, so a non-founder org member
-- could not read the org's palette (colors stay keyed to the primary client_id;
-- task 8's "member sees the business brand" acceptance depends on this).
alter policy brand_colors_select on public.brand_colors
  using (
    is_admin()
    or brand_colors.client_id = auth.uid()
    or exists (
      select 1 from public.client_brand cb
      where cb.client_id = brand_colors.client_id
        and (select public.is_org_member(cb.org_id))
    )
  );

-- fold-in B: service_preview resolved the brand via the project's client_id.
-- Once a project's contact can differ from the founder, that misses the org
-- brand; repoint to the org's primary brand (forward-safe, behavior-preserving
-- today since every branch project's contact still is the founder).
create or replace function public.service_preview(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  left join public.client_brand cb on cb.org_id = p.org_id and cb.is_org_primary
  where ps.project_id = v_proj;
  return v_result;
end;
$function$;

notify pgrst, 'reload schema';

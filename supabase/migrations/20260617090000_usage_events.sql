-- ============================================================
-- 0042 — Usage analytics events (first-party, admin EXCLUDED)
-- Lightweight in-app usage tracking for the admin analytics page: logins,
-- page views, and a few key actions. No third party, no content recorded.
-- The admin (Ori) is NEVER measured — the write RPC drops admin/anon activity.
-- ============================================================

create table public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles on delete set null,
  role       text,
  event      text not null,
  path       text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index usage_events_created_idx on public.usage_events (created_at);
create index usage_events_event_idx   on public.usage_events (event, created_at);

alter table public.usage_events enable row level security;

-- Only the admin reads analytics. Clients/partners can never see this table.
create policy usage_events_admin_select on public.usage_events
  for select to authenticated using (public.is_admin());
-- No direct INSERT policy: all writes go through the definer RPC below, which
-- filters out the admin so Ori's own usage is never recorded.

create or replace function public.log_usage_event(
  p_event text, p_path text default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text;
begin
  if v_uid is null then return; end if;
  v_role := public.get_my_role();
  -- Never measure the admin — only clients and partners.
  if v_role is null or v_role = 'admin' then return; end if;
  insert into public.usage_events (user_id, role, event, path, meta)
    values (v_uid, v_role, left(p_event, 60), left(p_path, 200), p_meta);
end;
$$;
revoke execute on function public.log_usage_event(text, text, jsonb) from anon;
grant execute on function public.log_usage_event(text, text, jsonb) to authenticated;

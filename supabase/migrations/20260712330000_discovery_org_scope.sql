-- ============================================================
-- Discovery sessions become ORG-centric (align with the org model).
-- A discovery call is WITH a business (org), some of its members ATTENDED,
-- and it is ABOUT a project. So:
--   * org_id       - the business the call was with (nullable = a lead with no org yet)
--   * attendee_ids - which people were in the call (record only; does NOT gate access)
-- The finished (status='done') summary is shown in the portal to EVERY member of
-- the org (is_org_member), not just a single client_id. Org-less sessions (leads)
-- keep the legacy client_id fallback so old rows still surface for that user.
-- Additive + non-destructive: client_id column stays for backward compatibility.
-- ============================================================

alter table public.discovery_sessions
  add column if not exists org_id uuid references public.organizations on delete set null;

alter table public.discovery_sessions
  add column if not exists attendee_ids uuid[] not null default '{}'::uuid[];

create index if not exists discovery_sessions_org_idx
  on public.discovery_sessions (org_id);

-- Backfill existing rows: derive the org from the linked client's membership
-- (their solo org / earliest membership), and seed the attendee list with that
-- client so nothing is lost.
update public.discovery_sessions ds
   set org_id = (
     select om.org_id
     from public.organization_members om
     where om.user_id = ds.client_id
     order by om.created_at, om.org_id
     limit 1
   )
 where ds.client_id is not null
   and ds.org_id is null;

update public.discovery_sessions ds
   set attendee_ids = array[ds.client_id]
 where ds.client_id is not null
   and (ds.attendee_ids is null or ds.attendee_ids = '{}'::uuid[]);

-- Client-facing list is now org-aware: any member of the session's org sees the
-- completed summary; org-less sessions fall back to the legacy client_id.
create or replace function public.get_my_discovery_sessions()
returns table (
  id           uuid,
  title        text,
  template_key text,
  share_token  text,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select id, title, template_key, share_token, created_at
  from public.discovery_sessions ds
  where ds.status = 'done'
    and (
      (ds.org_id is not null and public.is_org_member(ds.org_id))
      or (ds.org_id is null and ds.client_id = auth.uid())
    )
  order by ds.created_at desc;
$$;

grant execute on function public.get_my_discovery_sessions() to authenticated;

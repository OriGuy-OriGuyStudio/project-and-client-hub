-- ============================================================
-- Organizations multi-tenancy — Phase 1 foundation (additive only)
-- Tables + org_id columns + access helpers + RLS on the org tables.
-- Nothing existing changes here; policy swaps come in later migrations.
-- ============================================================

-- 1) Org tables
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations on delete cascade,
  user_id           uuid not null references public.profiles on delete cascade,
  is_manager        boolean not null default false,
  can_finance       boolean not null default false,
  can_service_calls boolean not null default false,
  can_approve       boolean not null default false,
  can_files         boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists org_members_user_org_idx on public.organization_members (user_id, org_id);
create index if not exists org_members_org_user_idx  on public.organization_members (org_id, user_id);

-- 2) org_id columns on the tables that move to org-level
alter table public.projects           add column if not exists org_id uuid references public.organizations on delete set null;
alter table public.client_brand        add column if not exists org_id uuid references public.organizations on delete cascade;
alter table public.admin_client_notes  add column if not exists org_id uuid references public.organizations on delete cascade;

create index if not exists projects_org_idx          on public.projects (org_id);
create index if not exists client_brand_org_idx       on public.client_brand (org_id);
create index if not exists admin_client_notes_org_idx on public.admin_client_notes (org_id);

-- 3) Access helpers (reference the org tables + projects.org_id above)
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                 where m.org_id = p_org and m.user_id = auth.uid());
$$;

create or replace function public.is_org_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.is_manager);
$$;

create or replace function public.can_access_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    join public.organization_members m on m.org_id = pr.org_id
    where pr.id = p_project and m.user_id = auth.uid()
  );
$$;

create or replace function public.member_can(p_project uuid, p_cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    join public.organization_members m on m.org_id = pr.org_id
    where pr.id = p_project and m.user_id = auth.uid()
      and case p_cap
        when 'finance'       then m.can_finance
        when 'service_calls' then m.can_service_calls
        when 'approve'       then m.can_approve
        when 'files'         then m.can_files
        else false end
  );
$$;

grant execute on function public.is_org_member(uuid), public.is_org_manager(uuid),
  public.can_access_project(uuid), public.member_can(uuid, text) to authenticated;

-- 4) RLS on the org tables (the membership table holds the money permissions,
--    so a read leak here is the worst case — lock it down explicitly).
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;

create policy organizations_admin_all on public.organizations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy organizations_member_read on public.organizations
  for select to authenticated using ((select public.is_org_member(id)));

create policy org_members_admin_all on public.organization_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy org_members_self_read on public.organization_members
  for select to authenticated using (user_id = auth.uid());
create policy org_members_manager_read on public.organization_members
  for select to authenticated using ((select public.is_org_manager(org_id)));

notify pgrst, 'reload schema';

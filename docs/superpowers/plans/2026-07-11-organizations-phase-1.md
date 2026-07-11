# Organizations Multi-Tenancy — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the organization (business) tenant and route all project
access through it, so multiple people can share a business's projects — without
changing anything visible for existing (solo) clients.

**Architecture:** Additive layer (approach "B"). Add `organizations` +
`organization_members`, add `org_id` to `projects`/`client_brand`/
`admin_client_notes`, migrate each existing client to a solo org, and swap every
project-scoped RLS policy from `owns_project()` to a single new helper
`can_access_project()`. Capability columns exist but are NOT enforced in Phase 1
(the migrated manager holds all of them); enforcement is Phase 2.

**Tech Stack:** Supabase Postgres + RLS, `SECURITY DEFINER` helper functions,
migrations applied via the Supabase MCP `apply_migration`, React + TanStack Query
frontend (mostly untouched in Phase 1 — RLS does the filtering).

## Global Constraints

- Apply every migration to the **branch `dbchappsqcsixxecxzqv` (portal-test)
  FIRST**, verify, then prod `tirasinbjsotcrqggipe` only after Ori's QA.
- All new tables have **RLS enabled** with explicit policies. No table ships
  RLS-open.
- Helper functions are `SECURITY DEFINER ... SET search_path = public` and marked
  **`STABLE`**.
- Every policy that calls a helper wraps it in a **scalar subquery**:
  `USING ((select public.can_access_project(project_id)))` — forces InitPlan
  caching (once per query, not per row).
- Verify DB work by **role simulation**: `select set_config('request.jwt.claims',
  '{"sub":"<uid>","role":"authenticated"}', true); set local role authenticated;
  <query>; reset role;` Always run each statement group in its own MCP call (a
  failing statement rolls the whole batch back).
- Frontend must keep `npx tsc -b` and `npm run build` green.
- Work on the `staging` branch; do not merge to `main`/prod until Ori approves.
- `projects.client_id` is **retained** through Phase 1 (do not drop). It becomes
  "primary contact"; access no longer depends on it.

---

## Artifact structure

New migration files under `supabase/migrations/` (timestamped, ordered):
1. `..._org_tables.sql` — organizations + organization_members + indexes + RLS.
2. `..._org_id_columns.sql` — org_id on projects / client_brand / admin_client_notes.
3. `..._org_access_helpers.sql` — is_org_member + can_access_project.
4. `..._org_backfill.sql` — migrate existing clients to solo orgs.
5. `..._org_rls_swap_<group>.sql` — one file per table group (Tasks 6a..6f).

Reference (read before Task 6, to capture exact current policies): the policy
bodies live across the existing migrations, but the **authoritative current state
is the live DB** — capture it from `pg_policies` (Task 5), don't hand-copy.

---

### Task 1: Organization tables + their own RLS

**Files:**
- Create: `supabase/migrations/20260712100000_org_tables.sql`

**Interfaces:**
- Produces: tables `public.organizations(id uuid pk, name text, created_at)`,
  `public.organization_members(id, org_id, user_id, is_manager, can_finance,
  can_service_calls, can_approve, can_files, created_at, unique(org_id,user_id))`.

- [ ] **Step 1: Write the migration**

```sql
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

-- Performance: membership lookups both directions.
create index if not exists org_members_user_org_idx on public.organization_members (user_id, org_id);
create index if not exists org_members_org_user_idx  on public.organization_members (org_id, user_id);

alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;

-- Policies that need ONLY auth.uid()/is_admin (no helper dependency) go here.
-- The helper-based read policies are added in Task 3, AFTER the helpers exist.
create policy organizations_admin_all on public.organizations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy org_members_self_read on public.organization_members
  for select to authenticated
  using (user_id = auth.uid());
create policy org_members_admin_all on public.organization_members
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
```

**Ordering:** apply this file (tables) FIRST, then Task 3 (helpers, which
reference these tables), then the helper-based org-table read policies (appended
to Task 3's file). SQL-language functions validate their table references at
creation, and policies validate their function references at creation, so the
order tables → helpers → helper-based-policies is mandatory.

- [ ] **Step 2: Apply to branch**

MCP `apply_migration` (project `dbchappsqcsixxecxzqv`, name `org_tables`) with the SQL above.
Expected: `{"success":true}`.

- [ ] **Step 3: Verify tables + RLS exist**

MCP `execute_sql` (branch):
```sql
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('organizations','organization_members');
```
Expected: both rows, `rowsecurity = true`.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260712100000_org_tables.sql
git commit -m "feat(org): organizations + organization_members tables + RLS"
```

---

### Task 2: org_id columns (additive, nullable)

**Files:**
- Create: `supabase/migrations/20260712100100_org_id_columns.sql`

**Interfaces:**
- Produces: `projects.org_id`, `client_brand.org_id`, `admin_client_notes.org_id`
  (all `uuid references organizations`, nullable for now).

- [ ] **Step 1: Write the migration**

```sql
alter table public.projects           add column if not exists org_id uuid references public.organizations on delete set null;
alter table public.client_brand       add column if not exists org_id uuid references public.organizations on delete cascade;
alter table public.admin_client_notes add column if not exists org_id uuid references public.organizations on delete cascade;

create index if not exists projects_org_idx           on public.projects (org_id);
create index if not exists client_brand_org_idx        on public.client_brand (org_id);
create index if not exists admin_client_notes_org_idx  on public.admin_client_notes (org_id);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply to branch** (name `org_id_columns`). Expected `{"success":true}`.

- [ ] **Step 3: Verify columns**

```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and column_name='org_id'
  and table_name in ('projects','client_brand','admin_client_notes') order by 1;
```
Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260712100100_org_id_columns.sql
git commit -m "feat(org): add org_id to projects, client_brand, admin_client_notes"
```

---

### Task 3: Access helper functions (apply FIRST — see ordering)

**Ordering note:** apply this migration BEFORE Task 1's policy statements
reference `is_org_member`/`is_org_manager`. In practice: name the files so this
sorts first, or apply this SQL, then Task 1, then Task 2. Keep the file timestamp
`...095900...` (before Task 1's `...100000...`).

**Files:**
- Create: `supabase/migrations/20260712095900_org_access_helpers.sql`

**Interfaces:**
- Produces: `is_org_member(p_org uuid) -> boolean`,
  `is_org_manager(p_org uuid) -> boolean`,
  `can_access_project(p_project uuid) -> boolean`,
  `member_can(p_project uuid, p_cap text) -> boolean` (defined now, enforced in
  Phase 2).

- [ ] **Step 1: Write the migration**

```sql
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_manager(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.is_manager
  );
$$;

create or replace function public.can_access_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    join public.organization_members m on m.org_id = pr.org_id
    where pr.id = p_project and m.user_id = auth.uid()
  );
$$;

-- Phase 2 will enforce this; defined now so policies can reference it later.
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

-- Helper-based read policies on the org tables (helpers now exist).
-- organizations: a member can read their org.
create policy organizations_member_read on public.organizations
  for select to authenticated
  using ((select public.is_org_member(id)));
-- organization_members: a manager reads their whole org's members.
create policy org_members_manager_read on public.organization_members
  for select to authenticated
  using ((select public.is_org_manager(org_id)));

notify pgrst, 'reload schema';
```

**Apply Task 1 (tables) BEFORE this file.** (This migration's helpers reference
the org tables, and these two policies reference the helpers.)

- [ ] **Step 2: Apply to branch** (name `org_access_helpers`). Expected `{"success":true}`.

- [ ] **Step 3: Verify functions exist**

```sql
select proname from pg_proc where proname in
('is_org_member','is_org_manager','can_access_project','member_can') order by 1;
```
Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260712095900_org_access_helpers.sql
git commit -m "feat(org): access helpers (is_org_member/can_access_project/member_can)"
```

---

### Task 4: Backfill migration (existing clients -> solo orgs)

**Files:**
- Create: `supabase/migrations/20260712100200_org_backfill.sql`

**Interfaces:**
- Consumes: org tables (Task 1), org_id columns (Task 2).
- Produces: one org + one manager membership per existing client; `org_id`
  populated on their projects / brand / notes.

- [ ] **Step 1: Write the migration**

```sql
do $$
declare c record; v_org uuid;
begin
  for c in
    select p.id as client_id,
           coalesce(nullif(btrim(cb.business_name), ''), nullif(btrim(p.full_name), ''), p.email) as name
    from public.profiles p
    left join public.client_brand cb on cb.client_id = p.id
    where p.role = 'client'
      and not exists (select 1 from public.organization_members m where m.user_id = p.id)
  loop
    insert into public.organizations (name) values (c.name) returning id into v_org;
    insert into public.organization_members
      (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
      values (v_org, c.client_id, true, true, true, true, true);
    update public.projects           set org_id = v_org where client_id = c.client_id and org_id is null;
    update public.client_brand        set org_id = v_org where client_id = c.client_id and org_id is null;
    update public.admin_client_notes  set org_id = v_org where client_id = c.client_id and org_id is null;
  end loop;
end $$;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply to branch** (name `org_backfill`). Expected `{"success":true}`.

- [ ] **Step 3: Verify every client has exactly one org + all their projects tagged**

```sql
-- clients without a membership (must be 0):
select count(*) as clients_without_org from public.profiles p
where p.role='client' and not exists (select 1 from public.organization_members m where m.user_id=p.id);
-- projects owned by a client but missing org_id (must be 0):
select count(*) as projects_without_org from public.projects pr
join public.profiles p on p.id = pr.client_id and p.role='client'
where pr.org_id is null;
```
Expected: both `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260712100200_org_backfill.sql
git commit -m "feat(org): backfill existing clients into solo organizations"
```

---

### Task 5: Capture the current project-scoped policies (the swap source of truth)

No hand-copying policy bodies from memory. Snapshot the live policies so Task 6
transforms the real, current expressions.

**Files:** none (produces a captured list you paste into Task 6 sub-files).

- [ ] **Step 1: List every policy that gates a project-scoped table by ownership**

MCP `execute_sql` (branch):
```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and (qual ilike '%owns_project%' or qual ilike '%client_id%'
       or with_check ilike '%owns_project%' or with_check ilike '%client_id%')
order by tablename, policyname;
```

- [ ] **Step 2: Record the result** into the plan's working notes. This is the
  exact set of policies Task 6 rewrites. Group the tablenames into the six groups
  used in Task 6 (files/folders/docs; stages/tasks/approvals; messages;
  project_service/site_metrics/maintenance_log; service_calls; service_agreements).
  Any table not obviously in a group gets its own mini-task.

---

### Task 6 (a–f): Swap each group's client gate to `can_access_project`

For EACH group below, one migration file. **The transformation rule is
mechanical:** in every client-facing `SELECT/INSERT/UPDATE/DELETE` policy captured
in Task 5, replace the ownership predicate (`public.owns_project(project_id)` or
`client_id = auth.uid()`) with `(select public.can_access_project(project_id))`.
Keep admin policies (`is_admin()`) untouched. Preserve every other predicate in
the expression verbatim (only the ownership term changes).

Worked example (files group) — the real `qual` comes from Task 5; this shows the
exact shape:

```sql
-- BEFORE (captured):  using (owns_project(project_id) and not is_private) ...
-- AFTER:
drop policy if exists <captured_policyname> on public.files;
create policy <captured_policyname> on public.files
  for select to authenticated
  using ((select public.can_access_project(project_id)) and not is_private);
```

- [ ] **Task 6a — files, project_folders, project_docs**
  - Create `supabase/migrations/20260712100300_org_rls_files.sql` with the
    transformed policies for these tables (from Task 5 capture).
  - Apply to branch. Expected `{"success":true}`.
  - Isolation test (Task 8 template) for `files`. Expected: cross-org read = 0 rows.
  - Commit: `feat(org): route files/folders/docs RLS through can_access_project`.

- [ ] **Task 6b — project_stages, stage_tasks, approvals**
  - `..._org_rls_stages.sql`; transform; apply; isolation test; commit.

- [ ] **Task 6c — messages**
  - `..._org_rls_messages.sql`; transform; apply; isolation test; commit.

- [ ] **Task 6d — project_service, site_metrics, maintenance_log**
  - `..._org_rls_service.sql`; transform; apply; isolation test; commit.
  - NOTE: this group is the biggest by row count — run the performance check
    (Task 9) right after applying this one.

- [ ] **Task 6e — service_calls**
  - `..._org_rls_service_calls.sql`; transform; apply; isolation test; commit.

- [ ] **Task 6f — service_agreements + any table left from Task 5**
  - `..._org_rls_agreements.sql`; transform; apply; isolation test; commit.

Each 6x task's steps:
1. Write the transformed policies (from the Task 5 capture) into the file.
2. Apply to branch via `apply_migration`. Expected `{"success":true}`.
3. Run the Task 8 isolation test for that group's tables. Expected: 0 cross-org rows.
4. Commit.

---

### Task 7: RPCs that still resolve the client by `client_id`

Some `SECURITY DEFINER` RPCs join/filter by `client_id`. In Phase 1 they still
work for solo orgs, but must resolve access by org membership so a secondary
member (Phase 2) is served. Audit and update where the RPC returns a client's own
data based on `auth.uid()` matching `client_id`.

**Files:**
- Create: `supabase/migrations/20260712100400_org_rpc_access.sql`

- [ ] **Step 1: Find candidate RPCs**

```sql
select proname from pg_proc
where pronamespace='public'::regnamespace
  and prosrc ilike '%client_id%' and prosrc ilike '%auth.uid()%'
order by 1;
```

- [ ] **Step 2: For each that gates "my own data" by `client_id = auth.uid()`**
  (e.g. `service_preview` is token-based — skip; client-self RPCs like
  `get_my_discovery_sessions`, `client_service_summary` if they exist), rewrite the
  access check to `is_org_member(<the row's org>)` or `can_access_project(<project>)`.
  Write each updated function body into the migration file (full `create or
  replace`, copied from the current definition with only the access predicate
  changed).

- [ ] **Step 3: Apply to branch. Verify** each updated RPC still returns the
  owner's data via role simulation (as the migrated client). Expected: same rows
  as before the change.

- [ ] **Step 4: Commit** `feat(org): resolve client RPC access via org membership`.

---

### Task 8: Cross-tenant isolation — the release gate

This is the acceptance test for Phase 1. It must pass before prod.

- [ ] **Step 1: Seed two distinct orgs on the branch** (if not already present):
  two client users A and B, each with a project (`pA` in org 1, `pB` in org 2).
  Use existing seeded clients if they are in different orgs.

- [ ] **Step 2: As user A, attempt to read user B's project data across every
  project-scoped table.** MCP `execute_sql`:
```sql
select set_config('request.jwt.claims', '{"sub":"<A_uid>","role":"authenticated"}', true);
set local role authenticated;
select
 (select count(*) from public.projects           where id = '<pB>')            as projects,
 (select count(*) from public.files              where project_id = '<pB>')    as files,
 (select count(*) from public.project_service    where project_id = '<pB>')    as service,
 (select count(*) from public.site_metrics       where project_id = '<pB>')    as metrics,
 (select count(*) from public.maintenance_log    where project_id = '<pB>')    as maint,
 (select count(*) from public.service_calls      where project_id = '<pB>')    as calls,
 (select count(*) from public.service_agreements where project_id = '<pB>')    as agreements,
 (select count(*) from public.messages           where project_id = '<pB>')    as messages;
reset role;
```
Expected: **every column is 0.**

- [ ] **Step 3: As user A, confirm A still sees A's OWN project** (regression):
  same query with `<pA>` → non-zero where data exists. Expected: A's data visible.

- [ ] **Step 4: Record the gate result** in the plan notes. If any cross-org count
  is > 0, STOP — a policy was missed; return to Task 6.

---

### Task 9: RLS performance check

- [ ] **Step 1: On the biggest client screen's query** (service dashboard: a
  client with many `site_metrics`/`maintenance_log` rows), run `EXPLAIN ANALYZE`
  as that client via role simulation for the `site_metrics` select.
- [ ] **Step 2: Confirm** the plan shows the helper evaluated via an **InitPlan /
  once**, not a per-row `SubPlan`/function scan. Expected: helper appears once.
- [ ] **Step 3: If per-row**, verify the policy uses `(select
  public.can_access_project(...))` (scalar subquery) and the indexes from Tasks
  1–2 exist; re-apply the corrected policy. Re-run Step 1.

---

### Task 10: Frontend smoke — nothing broke

Phase 1 changes almost no frontend code (RLS does the filtering; solo orgs behave
identically). This task confirms that.

- [ ] **Step 1:** `npx tsc -b` → Expected `TSC:0`.
- [ ] **Step 2:** `npm run build` → Expected `built` / exit 0.
- [ ] **Step 3:** In the preview (branch DB), load the client dashboard, a project
  page, and `/service` as a migrated client and confirm projects/files/service
  still render (no empty states, no console errors). Use preview_snapshot +
  preview_console_logs (level error).
- [ ] **Step 4: Commit** any incidental fixes; otherwise no commit.

---

## Ship gate (after all tasks pass on branch)

- [ ] Cross-tenant isolation (Task 8) = all zeros; own-data regression passes.
- [ ] Performance (Task 9) = helper cached, dashboard not slower.
- [ ] `tsc`/`build` green; preview smoke clean.
- [ ] Ori QA on the branch, then apply migrations 1–7 to **prod**
  `tirasinbjsotcrqggipe` (same order), re-run the Task 8 isolation gate on prod,
  then merge `staging` → `main`.

## Not in Phase 1 (own plans later)

- Capability enforcement (the 4 toggles in RLS + UI), admin member-management UI,
  member-invite request form + inbox, pending-membership auth linkage → **Phase 2 plan**.
- Per-project block, business-level credits, self-service, multi-org badge → **Phase 3 plan**.
  (The multi-org badge only matters once invites can create multi-org users, i.e. Phase 2+.)

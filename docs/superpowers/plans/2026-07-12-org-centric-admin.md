# Org-Centric Admin ("Businesses") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the business (organization) the first-class admin entity — a
businesses list, a business detail page (members + projects + org brand + org CRM),
with brand and CRM moved to the org level and each project carrying a per-project
"responsible contact" — without losing any existing data.

**Architecture:** Builds on the deployed Phase 1 + Phase 2 org model (`org_id` on
every project-scoped table; `organization_members`, capability RPCs, member
management all on `staging`). Migrations are applied to the Supabase **branch
`dbchappsqcsixxecxzqv`** via the MCP and verified by role simulation before prod.
Frontend is React + TypeScript + Vite + TanStack Query; `src/types/database.ts` is
hand-authored. Data migrations ARCHIVE, never hard-delete.

**Tech Stack:** Supabase Postgres + RLS (Supabase MCP `apply_migration`), React 18 +
TS, TanStack Query, Tailwind + shadcn-style components, Hebrew/RTL.

## Global Constraints

- Apply every migration to branch `dbchappsqcsixxecxzqv` FIRST; verify by role
  simulation; prod `tirasinbjsotcrqggipe` only after Ori QA. Work on git `staging`;
  never merge to `main` without Ori's approval.
- **Never hard-delete brand/CRM data.** Archive to a dedicated table (reversible).
- **Founding member of an org** = `select user_id from public.organization_members
  where org_id = :org order by created_at, user_id limit 1`. Use this exact
  definition everywhere "the business's canonical person" is needed.
- Cross-tenant isolation must remain intact (a member of business A never reads
  business B's brand/CRM/projects). `is_admin()` bypasses; reads gate on
  `is_org_member(org_id)`, writes on `is_admin()`.
- Frontend must keep `npx tsc -b` and `npm run build` green. Hebrew/RTL, gendered
  copy via `gendered(profile?.gender, ...)`, NO em-dashes ("—") in UI copy, semantic
  Tailwind tokens, side Sheets (not centered dialogs) for add/edit.
- No unit-test suite exists: DB tasks verify by role simulation (documented queries
  + expected results); frontend tasks verify by `tsc`/`build` green; UI behavior is
  Ori's manual QA (state it, do not claim visual verification).
- Every DB migration ends with `notify pgrst, 'reload schema';`.

## File Structure

- `supabase/migrations/*` — new timestamped migrations (org kind, call-log org_id,
  brand archive + canonical, responsible-contact validation).
- `docs/superpowers/audits/2026-07-12-client-id-usage.md` — the client_id impact
  audit (Task 1 deliverable).
- `src/types/database.ts` — add `Organization.kind`, `ClientCallLog.org_id`,
  archive table type, new RPC signatures.
- `src/hooks/useBusinesses.ts` (new) — businesses list + counts + create-business.
- `src/hooks/useOrg.ts` (Phase 2B, extend) — org brand + org CRM reads.
- `src/pages/admin/Businesses.tsx` (new, replaces Clients as the route target) —
  the businesses table.
- `src/pages/admin/BusinessDetail.tsx` (new or ClientDetail refactor) — business
  detail page.
- `src/components/admin/AddBusinessSheet.tsx` (new).
- Brand consumers to repoint: `src/components/project/ProjectHero.tsx`,
  `src/components/project/BrandGuidelines.tsx` (or wherever brand is read),
  `src/components/brand/BrandIdentityEditor.tsx`, the client brand view.

---

# Phase 1 — Audit + scaffolding (visible value, no destructive migration)

### Task 1: client_id impact audit (read-only deliverable)

**Files:** Create `docs/superpowers/audits/2026-07-12-client-id-usage.md`

- [ ] **Step 1:** Grep the codebase for every read of a project's `client_id` and
  every DB function/policy referencing `projects.client_id` or copying it into a
  child row. Run and record results:

```bash
# frontend
grep -rn "client_id" src --include=*.ts --include=*.tsx | grep -vi "partner\|referral\|redemption\|coin"
```
And on the branch, list DB functions/policies referencing it:
```sql
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%.client_id%'
  and pg_get_functiondef(p.oid) ilike '%projects%';
select tablename, policyname, qual from pg_policies where qual ilike '%client_id%' and schemaname in ('public','storage');
```

- [ ] **Step 2:** In the audit doc, classify each hit as one of: (a) OK — treats
  client_id as "a member/contact" (still valid); (b) MUST CHANGE — assumes
  client_id is "the only viewer / the sole notification target / the owner". For
  each MUST CHANGE, note the task (later phase) that fixes it. Known suspects to
  resolve explicitly: `admin_open_service_call` (copies projects.client_id →
  service_calls.client_id), `useProjects`, the admin dashboard grouping by client,
  `client_service_summary`, ProjectHero's contact display, EditProjectSheet.
- [ ] **Step 3: Commit** the audit doc.

### Task 2: `organizations.kind` (real / demo / studio)

**Files:** Create `supabase/migrations/<ts>_org_kind.sql`; modify
`src/types/database.ts`, `src/lib/demo.ts` (or wherever `isDemoEmail`/
`isInternalClient` live).

**Interfaces:**
- Produces: `organizations.kind text not null default 'real'` (values
  `real`|`demo`|`studio`). Frontend `Organization.kind`.

- [ ] **Step 1: Write the migration.**

```sql
alter table public.organizations add column if not exists kind text not null default 'real'
  check (kind in ('real','demo','studio'));

-- backfill from the founding member's email using the same lists the app uses.
-- STUDIO emails and DEMO emails are enumerated here to match src/lib/demo.ts +
-- the internal-client list; keep them in sync.
with founder as (
  select distinct on (m.org_id) m.org_id, lower(pr.email) as email
  from public.organization_members m join public.profiles pr on pr.id = m.user_id
  order by m.org_id, m.created_at, m.user_id
)
update public.organizations o set kind = case
  when f.email in ('origuy@origuystudio.com') then 'studio'
  when f.email in ('origudev@gmail.com','origuydev@gmail.com','origuy2018@gmail.com','dana@example.com','galil@example.com','sample-client@example.com') then 'demo'
  else 'real' end
from founder f where f.org_id = o.id;

notify pgrst, 'reload schema';
```
(Confirm the exact demo/studio email lists against `src/lib/demo.ts` before running;
copy them verbatim so the DB split matches the current UI split.)

- [ ] **Step 2:** Apply to branch. Expect `{"success": true}`.
- [ ] **Step 3: Verify** (role simulation not needed — read as admin):
```sql
select kind, count(*) from public.organizations group by kind;
```
Expected: the studio org = `studio`; the seeded demo orgs = `demo`; real client orgs
= `real`. Cross-check the count against the current Clients-page demo/studio split.
- [ ] **Step 4:** Add `kind: "real" | "demo" | "studio"` to `Organization` in
  `database.ts` (register the `organizations` table type if not already present).
- [ ] **Step 5: Commit.**

### Task 3: Businesses list hook + page (table)

**Files:** Create `src/hooks/useBusinesses.ts`, `src/pages/admin/Businesses.tsx`;
modify the admin route + nav so "לקוחות" points at the businesses list (keep the
route path or add `/admin/businesses`; update `src/components/layout/nav-config.ts`).

**Interfaces:**
- Produces: `useBusinesses()` → `BusinessRow[]` where
  `BusinessRow = { id: string; name: string; kind: "real"|"demo"|"studio"; members: number; projects: number; last_activity: string | null }`.
  Backed by a definer RPC `admin_businesses()` (admin-only) that aggregates per org.

- [ ] **Step 1: Migration** `<ts>_admin_businesses.sql` — an admin RPC returning the
  aggregated list (avoids N+1 + PostgREST relationship friction):

```sql
create or replace function public.admin_businesses()
returns table(id uuid, name text, kind text, members integer, projects integer, last_activity timestamptz)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select o.id, o.name, o.kind,
    (select count(*)::int from public.organization_members m where m.org_id = o.id),
    (select count(*)::int from public.projects p where p.org_id = o.id),
    greatest(
      (select max(pr.last_seen_at) from public.organization_members m join public.profiles pr on pr.id=m.user_id where m.org_id=o.id),
      (select max(p.updated_at) from public.projects p where p.org_id=o.id)
    )
  from public.organizations o
  order by o.kind, o.name;
end; $function$;
grant execute on function public.admin_businesses() to authenticated;
notify pgrst, 'reload schema';
```
Apply to branch; verify as admin it returns one row per org with correct counts;
verify as a non-admin it raises `forbidden`.

- [ ] **Step 2:** `database.ts`: add `admin_businesses` to Functions (Returns the row
  array above).
- [ ] **Step 3:** `useBusinesses.ts`: TanStack Query hook calling the RPC, key
  `["admin-businesses"]`.
- [ ] **Step 4:** `Businesses.tsx`: a compact, sortable table (name, members,
  projects, last activity), grouped/split by `kind` (real / demo amber section /
  studio), each row links to the business detail. Match the existing page header
  style; Hebrew/RTL; no em-dashes.
- [ ] **Step 5:** Point the admin "לקוחות" nav/route at this page.
- [ ] **Step 6:** `tsc -b` + `build` green. Commit. (UI = Ori QA: businesses appear
  once each; מרק does not appear as a separate row.)

### Task 4: Guarded "Add business"

**Files:** Create `supabase/migrations/<ts>_admin_create_business.sql`,
`src/components/admin/AddBusinessSheet.tsx`; modify `Businesses.tsx` (button) +
`database.ts`.

**Interfaces:**
- Produces: RPC `admin_create_business(p_name text, p_manager_email text, p_kind text)`
  → `jsonb` `{ org_id, status }` where status ∈ `created` | `email_exists`.

- [ ] **Step 1: Migration.** The RPC checks the email first:

```sql
create or replace function public.admin_create_business(p_name text, p_manager_email text, p_kind text default 'real')
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_email text := lower(btrim(coalesce(p_manager_email,''))); v_org uuid; v_uid uuid; v_existing_org uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if btrim(coalesce(p_name,''))='' then raise exception 'empty name'; end if;
  if v_email='' or position('@' in v_email)=0 then raise exception 'invalid email'; end if;
  -- existing-email guard (spec-review #6): do not silently create a 2nd-org membership.
  select id into v_uid from public.profiles where lower(email)=v_email;
  if v_uid is not null then
    select m.org_id into v_existing_org from public.organization_members m where m.user_id=v_uid limit 1;
    if v_existing_org is not null then
      return jsonb_build_object('status','email_exists','org_id',v_existing_org);
    end if;
  end if;
  insert into public.organizations (name, kind) values (btrim(p_name), coalesce(nullif(p_kind,''),'real')) returning id into v_org;
  perform public.admin_add_org_member(v_org, v_email, p_name, true, true, true, true, true);  -- manager, all caps
  return jsonb_build_object('status','created','org_id',v_org);
end; $function$;
grant execute on function public.admin_create_business(text,text,text) to authenticated;
notify pgrst, 'reload schema';
```
Apply to branch; role-sim as admin: new email → `created` + org + manager pending;
an email that already manages an org → `email_exists` (no new membership).

- [ ] **Step 2:** `database.ts`: add `admin_create_business`.
- [ ] **Step 3:** `AddBusinessSheet.tsx`: side Sheet (business name + manager email +
  kind defaulting from email). On `email_exists`, show a confirm ("האימייל כבר שייך
  לעסק קיים") and link to that business instead of creating a duplicate.
- [ ] **Step 4:** Wire "הוסף עסק" in `Businesses.tsx`; invalidate `["admin-businesses"]`.
- [ ] **Step 5:** `tsc`/`build` green. Commit.

### Task 5: Business detail scaffold (reuses founding-member brand/CRM — KNOWN LIMITATION)

**Files:** Create `src/pages/admin/BusinessDetail.tsx` (or refactor
`src/pages/admin/ClientDetail.tsx`); modify routing.

**Interfaces:**
- Consumes: `admin_org_members(org)` + `admin_businesses()` (Phase 2B / Task 3);
  the founding member (computed in a small helper `useOrgFounder(orgId)` reading
  `organization_members order by created_at, user_id limit 1`).

- [ ] **Step 1:** Route `/admin/businesses/:orgId` → `BusinessDetail`. Header: org
  name + (for now) the founding member's brand. This is the KNOWN-LIMITATION window
  documented in the spec — annotate in code with a comment referencing the spec.
- [ ] **Step 2:** Render the Phase-2B `OrgMembersSection` for this org (already
  built) — members, caps, presets, pending, invite requests.
- [ ] **Step 3:** Render a projects table: `projects where org_id = :orgId`
  (add `useOrgProjects(orgId)` → `supabase.from("projects").select(...).eq("org_id",orgId)`),
  each row showing its responsible contact (client_id → member name) — read-only for
  now (the picker is Task 13).
- [ ] **Step 4:** Reuse the existing brand editor + CRM sections keyed on the
  founding member for now (repointed to org in Phase 2/3).
- [ ] **Step 5:** `tsc`/`build` green. Commit. (Ori QA: entering a business shows its
  members + projects.)

---

# Phase 2 — Brand → organization (archive, never destroy)

### Task 6: Pre-migration brand audit report (GATE)

**Files:** none (read-only query, recorded in the ledger / shared with Ori).

- [ ] **Step 1:** On the branch (and again on prod at ship time), run:
```sql
with founder as (
  select distinct on (m.org_id) m.org_id, m.user_id from public.organization_members m
  order by m.org_id, m.created_at, m.user_id
)
select o.id, o.name, cb.client_id, pr.email,
  cb.business_name, cb.logo_url is not null as has_logo, cb.business_description is not null as has_desc,
  (select count(*) from public.brand_colors bc where bc.client_id=cb.client_id) as colors
from public.client_brand cb
join public.organizations o on o.id = cb.org_id
join founder f on f.org_id = cb.org_id
left join public.profiles pr on pr.id = cb.client_id
where cb.client_id <> f.user_id  -- NON-founding member brands
  and (cb.business_name is not null or cb.logo_url is not null or cb.business_description is not null
       or exists (select 1 from public.brand_colors bc where bc.client_id=cb.client_id));
```
- [ ] **Step 2: GATE.** If this returns any rows, STOP and present them to Ori (a
  non-founding member has real brand data). Do not proceed to Task 7 until Ori
  confirms how to handle each (keep as the org brand instead / merge / discard).
  (Branch today returns 0 such rows — cea6d20f's 2nd brand is empty.)

### Task 7: Brand → org migration (canonical + archive)

**Files:** Create `supabase/migrations/<ts>_brand_to_org.sql`.

- [ ] **Step 1: Migration.** Archive non-founding brands (reversible), then key the
  brand read to the org via a view/column. Approach: add `client_brand.is_org_primary`
  and set it on the founding member's row; archive the rest.

```sql
create table if not exists public.client_brand_archive (like public.client_brand including all);
alter table public.client_brand_archive add column if not exists archived_at timestamptz not null default now();

alter table public.client_brand add column if not exists is_org_primary boolean not null default false;

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

notify pgrst, 'reload schema';
```
(Note: `brand_colors` stays keyed by the primary client_id; since only the primary
brand remains, colors resolve correctly. If a later cleanup re-keys colors to org,
do it as its own task.)

- [ ] **Step 2:** Apply to branch. Verify: each org has exactly one
  `is_org_primary=true` brand; `client_brand_archive` holds the removed rows;
  `org_brand(cea6d20f)` returns דנה's brand; a member (role-sim) reading the org
  brand via the client path sees the primary brand.
- [ ] **Step 3:** Cross-tenant role-sim: a member of org A cannot read org B's brand.
- [ ] **Step 4: Commit.**

### Task 8: Repoint frontend brand reads to the org brand

**Files:** Modify `src/hooks` brand hook(s), `ProjectHero.tsx`, `BrandGuidelines.tsx`,
`BrandIdentityEditor.tsx`, the client brand view, `database.ts`.

- [ ] **Step 1:** Add `useOrgBrand(orgId)` (reads `org_brand` RPC or `client_brand
  where org_id and is_org_primary`). Add `is_org_primary` to `ClientBrand` type.
- [ ] **Step 2:** In each brand consumer, resolve the brand by the project's/user's
  `org_id` instead of `client_id`. The project already exposes `org_id`; the client's
  own org = their membership org. Replace the client_id-keyed brand read.
- [ ] **Step 3:** Admin `BrandIdentityEditor` edits the org's primary brand row
  (writes to the `is_org_primary` row for the org). Admin-only (existing RLS).
- [ ] **Step 4:** `tsc`/`build` green. Commit. (Ori QA: a project shows the business
  brand; a member sees the business brand; admin edits it once for the business.)

### Task 9: Stop creating per-member brand rows in auth

**Files:** Create `supabase/migrations/<ts>_no_member_brand.sql`.

- [ ] **Step 1: Migration.** In `handle_new_user` + `ensure_my_profile`, only create
  a `client_brand` (marked `is_org_primary`) for a BRAND-NEW solo client (block b —
  they create their own org). An INVITED member (block a — materialized into an
  existing org) does NOT get a brand row. Re-create both functions from their current
  bodies (fetch with `pg_get_functiondef` first) changing only the client_brand
  insert to be gated on "this user is the org's founding member".
- [ ] **Step 2:** Apply to branch. Role-sim: simulate a new invited member signup
  (auth.users insert, rolled back) → no new client_brand row; a brand-new solo client
  → gets one primary brand. (Reuse the Phase 2A-4 test harness.)
- [ ] **Step 3: Commit.**

---

# Phase 3 — CRM → organization

### Task 10: `client_call_logs.org_id`

**Files:** Create `supabase/migrations/<ts>_call_logs_org.sql`; modify `database.ts`.

- [ ] **Step 1: Migration.**
```sql
alter table public.client_call_logs add column if not exists org_id uuid references public.organizations on delete cascade;
-- backfill each call log's org from the client's current membership (0 rows today).
update public.client_call_logs cl set org_id = m.org_id
  from public.organization_members m where m.user_id = cl.client_id and cl.org_id is null;
-- read policy: org members; write: admin.
alter policy client_call_logs_select on public.client_call_logs
  using (is_admin() or (select public.is_org_member(org_id)));
notify pgrst, 'reload schema';
```
(0 rows today, so backfill is a no-op; the column + policy are the deliverable.
Confirm the exact existing policy name before ALTER.)
- [ ] **Step 2:** Apply to branch; verify column + policy. `database.ts`: add
  `org_id` to `ClientCallLog`.
- [ ] **Step 3: Commit.**

### Task 11: Org-scoped CRM in business detail

**Files:** Modify `BusinessDetail.tsx` + the CRM components; `useOrg.ts` (add
`useOrgNotes(orgId)`, `useOrgCallLogs(orgId)`).

- [ ] **Step 1:** `useOrgNotes(orgId)` reads `admin_client_notes where org_id=:org`
  (grouped by person, showing `role_in_company`); `useOrgCallLogs(orgId)` reads
  `client_call_logs where org_id=:org`. Writes set `org_id`.
- [ ] **Step 2:** Business detail CRM section shows the org's notes (per-person
  grouped) + call log. Admin-only.
- [ ] **Step 3:** `tsc`/`build` green. Commit.

---

# Phase 4 — Responsible contact

### Task 12: Responsible-contact integrity

**Files:** Create `supabase/migrations/<ts>_responsible_contact.sql`.

- [ ] **Step 1: Migration.** (a) A trigger on `projects` insert/update of `client_id`
  that requires the new `client_id` to be a member of `org_id` (raise otherwise,
  admin-set only). (b) Extend `remove_org_member`: before deleting a membership,
  reassign any `projects` where that user is the responsible contact to the org's
  founding member.

```sql
create or replace function public.check_project_contact()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.client_id is not null and new.org_id is not null
     and not exists (select 1 from public.organization_members m where m.org_id=new.org_id and m.user_id=new.client_id) then
    raise exception 'responsible contact must be a member of the project org';
  end if;
  return new;
end; $function$;
drop trigger if exists trg_check_project_contact on public.projects;
create trigger trg_check_project_contact before insert or update of client_id, org_id on public.projects
  for each row execute function public.check_project_contact();
```
And re-create `remove_org_member` (fetch current body) to first run:
```sql
-- reassign this member's responsible-contact projects to the org's founding member
update public.projects p set client_id = (
  select m2.user_id from public.organization_members m2 where m2.org_id=v_org order by m2.created_at, m2.user_id limit 1)
where p.org_id = v_org and p.client_id = (select user_id from public.organization_members where id=p_member_id);
```
(insert this before the `delete from organization_members` line).

- [ ] **Step 2:** Apply to branch. Role-sim: assign a member as a project's contact,
  then remove them → the project's contact becomes the founding member (not
  dangling); setting a project's client_id to a non-member raises.
- [ ] **Step 3: Commit.**

### Task 13: "מנהל אחראי" picker

**Files:** Modify `EditProjectSheet.tsx` (+ the create-project flow) + `BusinessDetail.tsx`.

- [ ] **Step 1:** In project create/edit, add a "מנהל אחראי" select of the org's
  members (from `admin_org_members(org)`), defaulting to the founding member / a
  manager, writing `projects.client_id`. The org is the project's `org_id`.
- [ ] **Step 2:** Business detail projects table shows + lets admin reassign the
  contact (writes client_id via the guarded update; the Task-12 trigger validates).
- [ ] **Step 3:** `tsc`/`build` green. Commit.

---

## Ship gate (after branch QA + Ori)

- Re-run the Task-6 brand audit on PROD before the brand migration (prod may have
  non-founding brands with real data once members exist).
- Apply the migrations to prod in order; keep `client_brand_archive` (do not drop).
- Verify: businesses list correct; each org one primary brand; CRM org-scoped;
  responsible contacts valid. Then merge staging → main.

## Not in this plan (Phase 3+ / later)

Per-project member exclusion; business-level referral/credits; client self-service
team management; org switcher / multi-org badge; per-manager email fan-out;
re-keying `brand_colors` to org (only if a real need appears — the primary-brand
approach already resolves colors correctly).

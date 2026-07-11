# Organizations Multi-Tenancy — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make per-person capabilities real (enforce the 4 flags in DB + UI), let
the studio manage a business's members, and let a manager request to add someone —
so "add Tzachi as a viewer without financials" actually works end to end.

**Architecture:** Builds on Phase 1 (organizations + organization_members with
capability columns + `member_can(project, cap)` helper already exist and are
deployed to prod). Phase 2 = (2A) capability enforcement in RLS + client UI
gating + the pending-membership auth linkage; (2B) admin member-management UI +
the manager invite-request flow. Ship 2A first (testable by adding a member via
SQL), then 2B.

**Tech Stack:** Supabase Postgres + RLS (via Supabase MCP `apply_migration`),
Google-OAuth-only auth with `allowed_emails` + `handle_new_user()`, React +
TanStack Query.

## Global Constraints

- Apply every migration to the **branch `dbchappsqcsixxecxzqv` FIRST**, verify by
  role simulation, then prod `tirasinbjsotcrqggipe` only after Ori QA.
- Capability check = `(select public.member_can(project_id, '<cap>'))` (scalar
  subquery), where cap ∈ finance/service_calls/approve/files. `is_admin()` always
  bypasses. Managers do NOT auto-hold capabilities (explicit columns only).
- Frontend must keep `npx tsc -b` and `npm run build` green; Hebrew/RTL, gendered
  copy via `gendered(profile?.gender, ...)`.
- Work on `staging`; do not merge/ship to prod until Ori approves.
- Auth is Google-OAuth-only + `allowed_emails` whitelist; a `profiles` row is
  created by `handle_new_user()` on first sign-in. No new auth mechanism.

## KEY DECISION FOR ORI (money gating) — confirm before building Task 2A-1

Authoritative money lives in `service_agreements` and `payments` (both have
`project_id`) — these get **RLS gated by `member_can(project,'finance')`**, so a
non-finance member gets zero rows. Solid.

The nuance is `project_service.monthly_price`/`hourly_rate` + the ROI figure: that
table is read by every member for non-money data (tier, site_type, metrics), and
RLS can't hide a single column. Two options:

- **Option A (recommended, pragmatic):** move the money read into a finance-gated
  RPC `client_service_money(project)`; the dashboard shows price/ROI only to
  finance members and hides it otherwise. `project_service` SELECT stays open to
  members for the non-money fields. **Residual:** a technical non-finance member
  could still read `monthly_price` via a direct table query. Low risk for this
  audience; hardening is a later follow-up.
- **Option B (full):** the client reads `project_service` through a
  security-barrier view that NULLs the money columns for non-finance members.
  Closes the residual, more plumbing (new view + repoint the hook).

The plan below assumes **Option A**. If you want B, say so and I'll swap Task
2A-2.

---

# Phase 2A — enforcement + auth linkage

### Task 2A-1: Finance RLS on agreements + payments

**Files:** Create `supabase/migrations/<ts>_cap_finance_rls.sql`

- [ ] **Step 1: Write the migration** (ALTER POLICY, expression-only)

```sql
-- service_agreements: client read requires the finance capability. Agreements
-- with a project_id gate on member_can(project,'finance'); the (rare) null-
-- project agreement falls back to the client themself.
alter policy service_agreements_client_read on public.service_agreements
  using (
    case when project_id is not null
      then (select public.member_can(project_id, 'finance'))
      else (client_id = auth.uid()) end
  );

-- payments: finance-only for members.
alter policy payments_select on public.payments
  using ((select public.member_can(project_id, 'finance')) or is_admin());

notify pgrst, 'reload schema';
```

- [ ] **Step 2:** Apply to branch (`cap_finance_rls`). Expected `{"success":true}`.
- [ ] **Step 3: Test** — seed a second member on an existing branch org with
  `can_finance=false`, then as that member: `service_agreements` and `payments`
  reads for their org's project return **0**; the manager (can_finance=true) still
  sees them. (role simulation)
- [ ] **Step 4: Commit.**

### Task 2A-2: Finance-gated money RPC (Option A)

**Files:** Create `supabase/migrations/<ts>_client_service_money.sql`

- [ ] **Step 1:** Create `client_service_money(p_project uuid)` returning
  `monthly_price numeric, hourly_rate numeric` — `SECURITY DEFINER`, raises
  `forbidden` unless `is_admin() or member_can(p_project,'finance')`; selects the
  money from `project_service`. grant to authenticated.
- [ ] **Step 2:** Apply to branch. **Step 3:** role-sim: finance member gets the
  numbers, non-finance member gets `forbidden`. **Step 4:** Commit.

### Task 2A-3: Capability gates on the write RPCs/policies

**Files:** Create `supabase/migrations/<ts>_cap_write_gates.sql`

- [ ] **Step 1: Write the migration**

```sql
-- open_service_call: also require the service_calls capability.
create or replace function public.open_service_call(p_project uuid, p_title text, p_description text default null, p_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid; v_name text;
  v_title text := left(btrim(coalesce(p_title,'')),160);
  v_desc text := nullif(left(btrim(coalesce(p_description,'')),4000),'');
begin
  if not (public.is_admin() or public.member_can(p_project,'service_calls')) then
    raise exception 'forbidden';
  end if;
  if v_title='' then raise exception 'empty title'; end if;
  insert into public.service_calls (project_id, client_id, title, description, attachments, created_by)
  values (p_project, auth.uid(), v_title, v_desc, coalesce(p_attachments,'[]'::jsonb), auth.uid())
  returning id into v_id;
  select coalesce(nullif(btrim(pr.full_name),''), pr.email) into v_name from public.profiles pr where pr.id = auth.uid();
  insert into public.notifications (audience, recipient_id, type, title, body, link, project_id, entity_id)
  values ('admin', null, 'service_call', 'קריאת שירות חדשה' || coalesce(' מ' || v_name,''), v_title, '/admin/service-calls', p_project, v_id);
  return v_id;
end; $function$;

-- approvals: client update requires the approve capability.
alter policy approvals_client_update on public.approvals
  using ((select public.member_can(project_id,'approve')) or is_admin())
  with check ((select public.member_can(project_id,'approve')) or is_admin());

-- files: upload/delete require the files capability (view/download stay open).
alter policy files_insert on public.files
  with check (is_admin() or ((select public.member_can(project_id,'files')) and (is_private = false) and (uploaded_by = auth.uid())));
alter policy files_delete on public.files
  using (is_admin() or ((uploaded_by = auth.uid()) and (not is_private) and (select public.member_can(project_id,'files'))));

-- storage insert/delete require files capability too (mirror of table policy).
alter policy project_files_insert on storage.objects
  with check ((bucket_id='project-files') and (is_admin() or (select public.member_can(storage_project_id(name),'files'))));
alter policy project_files_delete on storage.objects
  using ((bucket_id='project-files') and (is_admin() or (select public.member_can(storage_project_id(name),'files'))));

notify pgrst, 'reload schema';
```

- [ ] **Step 2:** Apply to branch. **Step 3:** role-sim a member with each cap off
  → the matching action is forbidden; with it on → allowed; manager/admin
  unaffected. **Step 4:** Commit.

### Task 2A-4: pending_members + handle_new_user linkage

**Files:** Create `supabase/migrations/<ts>_pending_members.sql`

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.pending_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  email text not null,
  is_manager boolean not null default false,
  can_finance boolean not null default false,
  can_service_calls boolean not null default false,
  can_approve boolean not null default false,
  can_files boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);
alter table public.pending_members enable row level security;
create policy pending_members_admin on public.pending_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pending_members_manager_read on public.pending_members
  for select to authenticated using ((select public.is_org_manager(org_id)));

-- Extend handle_new_user: after creating the profile, if the new user's email has
-- a pending membership, materialize it into organization_members (existing org).
-- Otherwise, for a brand-new client, create a solo org + manager membership and
-- link client_brand to it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_role text; v_full_name text; v_business_name text; v_gender text;
  v_rate numeric(5,2); v_min numeric(5,2); v_max numeric(5,2); v_notes text;
  v_org uuid;
begin
  select role, coalesce(full_name,''), business_name, gender, commission_rate, commission_rate_min, commission_rate_max, commission_notes
    into v_role, v_full_name, v_business_name, v_gender, v_rate, v_min, v_max, v_notes
  from public.allowed_emails where lower(email) = lower(new.email);
  if v_role is null then return new; end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, gender)
  values (new.id, new.email,
    coalesce(nullif(v_full_name,''), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url', v_role, v_gender)
  on conflict (id) do nothing;

  if v_role = 'client' then
    -- (a) invited member: materialize the pending membership(s) into the org.
    insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
    select pm.org_id, new.id, pm.is_manager, pm.can_finance, pm.can_service_calls, pm.can_approve, pm.can_files
    from public.pending_members pm where lower(pm.email) = lower(new.email)
    on conflict (org_id, user_id) do nothing;
    delete from public.pending_members where lower(email) = lower(new.email);

    -- (b) brand-new solo client (no membership yet): create org + manager membership.
    if not exists (select 1 from public.organization_members m where m.user_id = new.id) then
      insert into public.organizations (name)
        values (coalesce(nullif(v_business_name,''), nullif(v_full_name,''), new.email))
        returning id into v_org;
      insert into public.organization_members (org_id, user_id, is_manager, can_finance, can_service_calls, can_approve, can_files)
        values (v_org, new.id, true, true, true, true, true);
    end if;

    -- brand: attach to the user's org (first membership).
    insert into public.client_brand (client_id, business_name, org_id)
    values (new.id, v_business_name, (select org_id from public.organization_members m where m.user_id = new.id order by created_at limit 1))
    on conflict (client_id) do update set org_id = excluded.org_id where public.client_brand.org_id is null;
  elsif v_role = 'partner' then
    insert into public.partner_profiles (id, commission_rate, commission_rate_min, commission_rate_max, commission_notes, referral_code)
    values (new.id, coalesce(v_rate,5.0), coalesce(v_min, v_rate, 5.0), coalesce(v_max, v_rate, 5.0), v_notes, encode(extensions.gen_random_bytes(6),'hex'))
    on conflict (id) do nothing;
  end if;
  return new;
end; $function$;

notify pgrst, 'reload schema';
```

- [ ] **Step 2:** Apply to branch. **Step 3: Test** the two paths by simulating a
  fresh profile insert (or a scripted call) — (a) with a pending_members row for
  the email → membership materialized to the existing org, pending row cleared;
  (b) no pending, new client → new org + manager membership + client_brand.org_id
  set. **Step 4:** Commit.

  Note: `ensure_my_profile()` (called every login from `useAuth`) may also need
  the same pending-materialization block so a member whitelisted after their first
  login still gets linked. Include it in this migration if it exists.

### Task 2A-5: Client capability hook + UI gating

**Files:**
- Create: `src/hooks/useMyCapabilities.ts`
- Modify: `src/pages/client/Service.tsx` (hide price/ROI unless finance; gate the
  "open service call" button on service_calls), `src/pages/project/ProjectDetail.tsx`
  or the approvals/files components (gate approve buttons on approve; upload/delete
  on files).

**Interfaces:**
- Produces: `useMyCapabilities(projectId)` → `{ finance, service_calls, approve,
  files, isLoading }`, backed by a small definer RPC `my_capabilities(p_project)`
  returning the 4 booleans (admin → all true).

- [ ] **Step 1:** Migration: `my_capabilities(p_project uuid)` returns the 4 caps
  for auth.uid() on that project's org (admin → all true). Apply + test.
- [ ] **Step 2:** `useMyCapabilities` hook (TanStack Query, keyed by project).
- [ ] **Step 3:** In `Service.tsx`: read caps; hide the money Blocks/price/ROI and
  the agreements section unless `finance`; render the service-call button only if
  `service_calls`. Use `client_service_money` RPC for the price when finance.
- [ ] **Step 4:** Gate approve/upload/delete controls on `approve`/`files`.
- [ ] **Step 5:** `tsc`/`build` green; preview as a limited member (seed via SQL) —
  confirm the gated controls are hidden and the DB refuses if bypassed.
- [ ] **Step 6:** Commit.

---

# Phase 2B — member management + invite flow

### Task 2B-1: member_invite_requests table + RPCs

**Files:** Create `supabase/migrations/<ts>_member_invite_requests.sql`
- Table (org_id, requested_by, full_name, email, phone, req_can_* flags, note,
  status default 'pending', created_at, handled_at, handled_by) + RLS (manager
  insert/select own org; admin all).
- RPC `request_member_invite(...)` (manager-only, inserts a request + admin
  notification). RPC `approve_member_invite(p_id, caps...)` (admin-only: writes
  `allowed_emails` + `pending_members` + marks request approved) and
  `reject_member_invite(p_id)`.
- Apply + role-sim tests. Commit.

### Task 2B-2: Admin member-management UI (business card)

**Files:** Modify `src/pages/admin/ClientDetail.tsx` (or a new
`OrgMembersSection`), add hooks in `src/hooks/useOrg.ts`.
- Show the org's members with the 4 capability toggles + preset buttons
  ("מנהל" = is_manager + all caps; "צוות" = caps minus finance). Toggle writes via
  an admin RPC `set_member_capabilities(member_id, caps...)`. "הוסף חבר" writes
  allowed_emails + pending_members (or organization_members if the user already
  exists). Pending members shown distinctly.
- `tsc`/build; commit.

### Task 2B-3: Manager invite form (client) + admin inbox

**Files:** Modify client dashboard (add an "הזמן איש צוות" form for managers via
`request_member_invite`), and `src/components/admin/AdminTasksPanel.tsx` +
`src/hooks/useAdminTasks.ts` (surface pending `member_invite_requests`; approving
opens the add-member action pre-filled).
- Gender-correct Hebrew copy. `tsc`/build; commit.

### Task 2B-4: Notification fan-out to managers

**Files:** the notify paths that target a single `client_id` (service status, etc.)
→ target the org's manager(s). Update the relevant edge fn/RPC to resolve managers
from `organization_members where is_manager`. Test; commit.

---

## Ship gate (per sub-phase, after branch QA + Ori)

- 2A: cross-tenant isolation still green; a limited member is correctly blocked
  (DB + UI) from finance/service-call/approve/upload; manager/admin unaffected;
  the auth-linkage two paths verified. Then apply 2A migrations to prod + merge.
- 2B: a manager can request; admin approves → member materializes on first login
  with the requested caps. Then prod + merge.

## Not in Phase 2 (Phase 3)

Per-project block (a member excluded from one project), business-level
referral/credits, full self-service team management, the multi-org project-card
badge, and closing the `project_service` money residual (Option B) if desired.

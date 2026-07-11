# Organizations & multi-tenancy — design spec

Date: 2026-07-11
Status: approved for planning (not yet implemented)
Author: Ori Guy + Claude

## Problem

Today a project belongs to exactly one user: `projects.client_id -> profiles.id`,
and every RLS policy is scoped by `client_id = auth.uid()` (directly or via the
`owns_project()` helper). "Client" conflates two different things: the **person**
who logs in, and the **business** that owns the brand, projects, CRM and money.

Real businesses have several people who need access to the same project/dashboard
(e.g. a big client asked to "add Tzachi the CEO to the dashboard too"). Tzachi is
not a new client, he belongs to the same business. We cannot model that today
without opening a second, disconnected "client".

## Goal

Introduce a **business (organization)** as the tenant. Projects belong to an
organization. People are **members** of an organization and, by default, can see
all of its projects. Per-person **capabilities** gate the sensitive actions
inside a project (money, service calls, approvals, files). The studio (admin)
manages membership; a business manager can *request* to add a member via a form.

## Non-goals (v1 — YAGNI)

- **Referral / credit program stays per-user** (attached to the manager). It was
  never part of this problem; moving it to org-level is a possible later phase.
- **No full self-service team management.** Managers can only *request* to add a
  member (a form); the studio still creates the member.
- **No per-project blocking** in v1 (a member sees all the org's projects). A
  per-project exception is a later phase if ever needed.
- **One org per user is the common case.** The data model is many-to-many so a
  user *can* belong to several orgs, but there is no org-switcher UI in v1.

## Chosen approach: additive organization layer (approach "B")

Rejected alternatives:
- **Full rename** (`client_id` -> `org_id` everywhere): touches every table, every
  RLS policy and every frontend query at once. Highest break risk.
- **Project collaborators only** (no business entity, per-project grants): does
  not give the "umbrella" (brand/CRM stay per-user; access is per-project, which
  is the model we explicitly rejected).

The additive layer adds the org tables, routes access through **one helper
function** so most policies change in a single place, migrates existing clients
to a solo org, and rolls out in phases to keep break risk low.

## Data model

### New tables

**`organizations`** — the business / umbrella.
- `id uuid pk`
- `name text not null` — business name (Hebrew display name)
- `created_at timestamptz default now()`

**`organization_members`** — a person's membership + capabilities.
- `id uuid pk`
- `org_id uuid not null -> organizations`
- `user_id uuid not null -> profiles`
- `is_manager boolean not null default false` — the "primary contact". Governs
  ONE thing only: the right to open member-invite requests and to be the default
  notification recipient. It does **not** auto-grant any of the four data
  capabilities (see "is_manager is not a capability override" below).
- `can_finance boolean not null default false` — sees money (see Capabilities)
- `can_service_calls boolean not null default false`
- `can_approve boolean not null default false`
- `can_files boolean not null default false`
- `created_at timestamptz default now()`
- `unique (org_id, user_id)`

**`member_invite_requests`** — a manager's request for the studio to add a member.
- `id uuid pk`
- `org_id uuid not null -> organizations`
- `requested_by uuid not null -> profiles` (the manager)
- `full_name text`, `email text`, `phone text`
- `req_can_finance / req_can_service_calls / req_can_approve / req_can_files boolean`
  — the access the manager is asking for
- `note text`
- `status text not null default 'pending' check (status in ('pending','approved','rejected'))`
- `created_at`, `handled_at`, `handled_by`

### Changed tables

- **`projects`**: add `org_id uuid -> organizations`. This becomes the source of
  access. `client_id` is kept during the transition (meaning "created for /
  primary contact") and dropped once the frontend no longer reads it.
- **`client_brand`**: keyed to the org (add `org_id`; one brand per business).
- **`admin_client_notes`** (CRM): keyed to the org.

## Access model & RLS

All access flows through a small set of `SECURITY DEFINER` helpers so policies
change in one place, not thirty.

- `is_org_member(p_org uuid) -> boolean` — the current user has a membership row
  in `p_org`.
- `can_access_project(p_project uuid) -> boolean` — the current user is a member
  of the project's org. **Replaces `owns_project()`** as the client-side gate on
  every project-scoped table (files, tasks, approvals, messages, project_service,
  site_metrics, maintenance_log, service_calls, agreements, folders, docs, ...).
- `member_can(p_project uuid, p_cap text) -> boolean` — reads the member's
  explicit capability column (`can_finance`/`can_service_calls`/`can_approve`/
  `can_files`) for that project's org. It does NOT consult `is_manager`.
- `is_admin()` (studio) is unchanged and always full-access.

### is_manager is not a capability override

Capabilities are **always explicit columns**. `is_manager` is a separate flag and
never silently grants a data capability. This avoids the trap where an admin
un-checks "finance" on a manager and the toggle does nothing. The "מנהל" UI
preset sets `is_manager = true` AND all four capability columns = `true`, but they
remain independent, so the admin can still, say, leave a manager without
`can_finance` and it takes effect. Every toggle in the UI is always meaningful.

### RLS performance (must implement in Phase 1, not after)

`can_access_project` runs as an RLS check on every row of many large tables
(files, site_metrics, maintenance_log, messages, ...). Postgres can evaluate a
function per-row instead of once per query, which turns a busy dashboard slow.
Requirements:
- **Wrap the helper call in a scalar subquery** in every policy — `USING ((select
  can_access_project(project_id)))` — to force InitPlan caching (evaluated once
  per query, not per row). Same for `member_can`.
- Mark the helper functions `STABLE` (not `VOLATILE`).
- Indexes: `organization_members (user_id, org_id)`, `organization_members
  (org_id, user_id)`, and `projects (id, org_id)` (id is already the PK; add a
  covering index on `(org_id)` for the reverse lookup).
- Benchmark the heaviest client screen (service dashboard, files) on a seeded
  multi-row org before shipping Phase 1.

### RLS on the membership tables themselves (critical)

`organization_members` holds the money permissions, so a read leak here is worse
than any other table. Explicit policies:
- **`organizations`**: a user can `SELECT` an org they are a member of; only admin
  writes.
- **`organization_members`**: a member can `SELECT` their **own** row; a member
  with `is_manager` in that org can `SELECT` **all rows of their org** (to show
  the team list in Phase 2); **only admin can INSERT/UPDATE/DELETE** (no client
  ever edits capabilities — even a manager only *requests*).
- **`member_invite_requests`**: a manager can `INSERT`/`SELECT` requests for
  **their own org**; admin sees and updates all. No one else can read them.

### Capabilities (4 toggles + baseline)

Baseline for **any** member (no toggle needed): view the project, roadmap /
progress, chat, and view/download files.

Gated per-person:
- **`finance`** — signed agreements (price + legal), package price and ROI value
  on the service dashboard and reports, payments.
- **`service_calls`** — open/manage service calls.
- **`approve`** — approve milestones / designs / deliverables.
- **`files`** — upload and delete files (view/download is baseline).

Enforcement is **two-layered**:
1. **DB (non-bypassable):** RLS/`SECURITY DEFINER` RPCs check `member_can(...)`.
   - `service_agreements` client SELECT requires `finance`.
   - `open_service_call` RPC requires `service_calls`.
   - approval-update policy/RPC requires `approve`.
   - files insert/delete policy requires `files`.
   - Money-bearing fields that live on `project_service` (monthly_price,
     hourly_rate) and the ROI computation are returned only to `finance` members:
     the client service RPCs (`service_preview`, `client_service_summary`, and the
     dashboard query) omit money for non-finance members, or expose it via a
     finance-gated RPC.
2. **UI:** the frontend hides what the member cannot do (no price, no "open service
   call" button, no approve/upload buttons) based on the member's capabilities.

## Migration (non-breaking)

For each existing `profiles` row with `role = 'client'`:
1. Create an `organizations` row (`name` from `client_brand.business_name`, else
   the profile's full name).
2. Create an `organization_members` row: `user_id` = the client, `is_manager =
   true`, all four capabilities = `true`.
3. Backfill `projects.org_id` for that client's projects.
4. Re-key `client_brand.org_id` and `admin_client_notes.org_id`.

Result: every existing client becomes a **solo org with full access** — visually
and behaviorally identical to today. The migration is idempotent.

## Onboarding a NEW business (the common case after Phase 1)

The migration is one-time; from Phase 1 onward, a brand-new client must also get
an org. The org is created at the moment the studio onboards the first person:
- When the admin creates a client (the existing "create client" flow) or approves
  an `access_request`, we **create the `organizations` row and an
  `organization_members` row (that user, `is_manager = true`, all capabilities
  on)** in the same definer RPC.
- The maintenance-package landing/agreement flow (`submit_service_agreement`) must
  resolve or create the org too, so `projects.org_id` and the agreement are tied
  to a business, not a bare user.
- There is never a project without an `org_id` after Phase 1 (enforce with a NOT
  NULL + FK once the backfill is verified).

## Invite flow — auth integration (the hidden gap)

Auth is **Google OAuth only + `allowed_emails` whitelist**, and a `profiles` row
is created only on first sign-in by `handle_new_user()`. So a new member's
`user_id` does not exist yet when the admin "adds" them — we cannot insert an
`organization_members` row keyed by a `user_id` that isn't there.

Flow when the admin approves a `member_invite_requests` (or adds a member
directly):
1. Insert/ensure the email in `allowed_emails` (role `client`).
2. Record a **pending membership keyed by email** — either a `pending_members`
   table (`org_id`, `email`, capability flags, `is_manager`) or capability +
   `org_id` columns on `allowed_emails`. (Pick one during planning; a dedicated
   `pending_members` table is cleaner.)
3. The person signs in with Google. `handle_new_user()` / `ensure_my_profile()`
   is extended to, after creating the profile, **look up any pending membership by
   email and materialize the `organization_members` row** (then clear the pending
   record).
This reuses the existing whitelist + OAuth path; no new magic-link/email-auth
mechanism is introduced. This linkage must be spelled out and tested in Phase 2.

## Admin UI (studio)

- The "Clients" page becomes "Businesses" (organizations). A business card shows:
  its projects, its members list (each with the 4 capability toggles + preset
  buttons "מנהל" = all on / "צוות" = finance off), an "add member" action
  (whitelist email + create membership + set capabilities), and the pending
  **member-invite-requests** inbox for that org.
- Pending `member_invite_requests` also surface in the main dashboard
  "ממתין לטיפול" panel (like `access_requests`); approving pre-fills the
  add-member action with the requested details + capabilities.
- Landing links / agreements are created against an **org + project** (today's
  `client_id` on invites/agreements becomes the org's primary user + org_id).

## Client UI (members)

- On login a member sees **all their org's projects** (dashboard + `/service`).
- Financial UI (prices, ROI, agreements) shows only to `can_finance` members.
- "Open service call" only for `can_service_calls`; approve buttons only for
  `can_approve`; upload/delete only for `can_files`.
- A **manager** gets an "הזמן איש צוות" (invite teammate) form that creates a
  `member_invite_requests` row (name, email, phone, requested capabilities, note).
- **Business-name badge on project cards.** Even though there is no org switcher
  in v1, if a user ends up in more than one org (e.g. a mistaken invite) the
  dashboard would merge projects with no indication of which business each belongs
  to. Show a small business-name badge on the project card whenever the user
  belongs to more than one org. Cheap, and it prevents a real edge-case confusion.

## Phasing (keeps break risk low)

- **Phase 1 — plumbing.** Org tables + migration + `can_access_project` swapped
  into the RLS helpers. Multi-user access works. For every existing client
  nothing changes visually (solo org, manager with all capabilities). This is the
  risk-bearing phase because it touches RLS; ship and verify before Phase 2.
- **Phase 2 — capabilities + membership management.** The 4 capability flags
  enforced in RLS + UI, the admin member-management UI, and the member-invite
  request form + inbox.
- **Phase 3 — later / optional.** Per-project block, business-level
  referral/credits, fuller self-service.

## Rollback & safety (Phase 1 is the risk-bearing one)

Phase 1 touches RLS on many tables, so plan the retreat before shipping:
- **Additive schema is reversible.** `org_id` columns, the new tables, and the
  helper functions are non-destructive; `projects.client_id` is retained through
  Phase 1. Dropping the new objects restores the old shape.
- **The policy swap is the risky part.** Before changing any policy, the migration
  records the exact prior `USING`/`WITH CHECK` expression (in a comment or a
  captured `pg_policies` snapshot) so a down-migration can restore it verbatim.
- **`can_access_project` is written to be a strict superset of `owns_project`**
  for solo orgs, so if something misbehaves we can temporarily point the helper
  back at the old ownership check without touching 30 policies (single-function
  revert).
- **Roll out table-group by table-group**, verifying each on the Supabase branch
  (simulate members of two different orgs and confirm zero cross-org read) before
  prod. Never convert all tables in one migration.
- **Cross-tenant isolation test is a release gate:** as user A (org 1), attempt to
  read every project-scoped table for a project in org 2 — must return nothing.

## Risk / impact areas to audit (must review each)

- Every RLS policy referencing `client_id` / `owns_project()`.
- Every data hook: `useProjects`, `useProject(s)`, `useMyServices`,
  `useProjectService`, `useSiteMetrics`, `useMaintenanceLog`, `useServiceCalls`,
  `useMyAgreements`, `useAdminTasks` (agreements + service_calls), notifications.
- RPCs with `client_id` joins: `admin_maintenance_overview`, `service_preview`,
  `client_service_summary`, `submit_service_agreement`, `get_landing_context`,
  `open_service_call`, `admin_open_service_call`, discovery/referral RPCs.
- Landing + agreements: `submit_service_agreement` must set `org_id`; the
  per-project landing lock still works.
- Notifications:
  - **Admin-directed** (client opens a service call, sends a message → studio
    bell): these target the studio, not a specific client, so they fire correctly
    for **any** member from Phase 1 — the admin sees secondary members' actions.
    Verify this explicitly (don't assume).
  - **Client-directed** (service status changed → "notify the client"): today
    targets the single `client_id`. In Phase 1 (solo orgs) unchanged. From Phase 2
    (real multiple members) it targets the org's manager(s), or all members with
    the relevant capability. Decide the fan-out in Phase 2.
- Demo/studio separation (`isInternalClient` / `isDemoEmail` by email) still holds.
- Referral / credit program stays attached to the manager user (untouched).

## Open questions (resolve during planning)

- Exact list of money-bearing fields to gate behind `finance` (agreements vs
  project_service price vs ROI) and whether to gate `project_service` money at the
  RPC layer or UI-only.
- Notification fan-out in Phase 2 (managers only vs all members with the relevant
  capability).
- Pending-membership storage for the invite flow: a dedicated `pending_members`
  table (preferred) vs capability + `org_id` columns on `allowed_emails`.
- Whether to enforce `projects.org_id` NOT NULL immediately after backfill or keep
  it nullable through Phase 1 for safety.

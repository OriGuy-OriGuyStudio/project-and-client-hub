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
- `is_manager boolean not null default false` — can request member invites; the
  "primary contact". Presets aside, this is a real flag.
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
- `member_can(p_project uuid, p_cap text) -> boolean` — the member's capability
  flag (`finance`/`service_calls`/`approve`/`files`) for that project's org.
  `is_manager` implies all capabilities.
- `is_admin()` (studio) is unchanged and always full-access.

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
- Notifications: recipient is a user today. In Phase 2, "notify the client" should
  target the org's manager(s) (or relevant members). Phase 1 unchanged.
- Demo/studio separation (`isInternalClient` / `isDemoEmail` by email) still holds.
- Referral / credit program stays attached to the manager user (untouched).

## Open questions (resolve during planning)

- Exact list of money-bearing fields to gate behind `finance` (agreements vs
  project_service price vs ROI) and whether to gate `project_service` money at the
  RPC layer or UI-only.
- Notification fan-out in Phase 2 (managers only vs all members).

# Org-Centric Admin ("Businesses") — Design

**Date:** 2026-07-12 (rev 2 — hardened after spec review + live data audit)
**Status:** Approved (brainstorm). Next: implementation plan.
**Builds on:** Organizations multi-tenancy Phase 1 + Phase 2 (orgs, members,
capabilities, member management) — all on `staging`, `org_id` present on every
project-scoped table.

## Goal

Make the **business (organization) the first-class entity** in the admin, instead
of the individual person. Today the admin "לקוחות" page lists client *profiles*, so
an invited teammate (e.g. מרק, a member of דנה's business) shows up as a separate
"customer". The owner should instead see **businesses**; drilling into a business
shows its **members (people), projects, brand, and CRM**. This scales as the studio
grows to many businesses each with several people and projects.

The client side is unchanged conceptually: a member logs in and sees their
business's projects (RLS is already org-scoped); the brand they see is the
business's brand.

## Decisions (locked in brainstorm)

1. Brand lives at the business (org) level. One brand per business.
2. CRM (private admin notes + call log) lives at the business level.
3. A project belongs to the business (org). Each project has one **responsible
   contact** — a member of the org who is the point person (the existing
   `projects.client_id`, re-purposed from "owner" to "per-project contact"; must
   reference a member of the project's org).
4. "Add business" is minimal: business name + manager email.
5. Admin list views (businesses, projects) are compact, sortable **tables**;
   business detail + the whole client side stay **cards**. Presentation only.

## Live data audit (branch `dbchappsqcsixxecxzqv`, 2026-07-12) — grounds the migration

- `client_brand`: 6 rows, all with `org_id`. Most orgs = 1 brand. **`cea6d20f`
  (דנה) has 2 brand rows**: the founding member דנה (earliest membership; has
  business_name + description + 2 brand_colors = REAL) and מרק (later; business_name
  NULL, no logo, 0 colors = EMPTY signup default). Confirms: (a) non-founding
  members already accrue brand rows today, (b) "earliest member" picks the real
  brand, (c) here the non-founding brand is empty, but PROD may differ once members
  are added.
- `admin_client_notes`: **already has `org_id`, all populated (0 null)**, 1 row
  total. CRM notes are already org-scoped — no destructive migration needed.
- `client_call_logs`: keyed by `client_id`, **no `org_id`, 0 rows** — add `org_id`
  (backfill from the client's org), nothing to lose.
- PROD note: Phase 2 is not yet on prod, so prod orgs are still solo (1 member, 1
  brand) at the time of writing. The multi-member/multi-brand case only exists on
  the branch. The migration below must still be safe for prod's FUTURE multi-member
  state (after Phase 2 ships and members are added).

## Canonical definitions (removes ambiguity — spec-review #1)

- **Founding member of an org** = the `organization_members` row with the minimum
  `created_at` for that org, tie-broken by `user_id` for total determinism:
  `select user_id from organization_members where org_id = :org order by created_at, user_id limit 1`.
  This is the original Phase-1 solo client who owns the real brand — NOT "any
  manager" (an org can have several `is_manager=true` members; cea6d20f already
  does). Every migration/lookup that needs "the business's canonical person" uses
  this definition, in SQL, explicitly.

## Data model changes

### Brand → organization
- One brand per org. The org's brand = the **founding member's** `client_brand`
  (+ its `brand_colors`).
- **No hard deletes (spec-review #2).** Non-founding member brand rows are
  **archived** (moved to `client_brand_archive` with org_id + archived_at), never
  dropped, so a wrong pick or a member's real customization is recoverable.
- **Pre-migration audit GATE.** Before archiving, the migration/plan emits a report
  of any org where a NON-founding member's brand carries real data
  (business_name / logo_url / business_description / any brand_colors set). Ori
  reviews those rows before the archive step runs. (On the branch only cea6d20f has
  a 2nd brand and it is empty — safe; prod is re-audited at ship time.)
- Lookups repoint from `client_id` to `org_id` (one brand per org). Implementation
  detail (new `org_brand` table vs. re-keying `client_brand`) is the plan's call;
  the model is "one brand per organization, sourced from the founding member,
  member brands archived".
- `handle_new_user` / `ensure_my_profile`: a NEW member no longer creates their own
  brand row — they inherit the org brand. (Solo clients still get a brand, which is
  the org brand since they are the sole/founding member.)

### CRM → organization
- `admin_client_notes` already has `org_id` (populated) — the business detail simply
  reads notes `where org_id = :org` (grouped by person; `role_in_company` stays a
  per-person field shown under each member). **No note deletion or move.**
- `client_call_logs` gains `org_id` (backfilled from the client's org). Reads move
  to `where org_id = :org`.
- RLS: read by `is_org_member(org_id)`, write by `is_admin()`.

### Projects + responsible contact (spec-review #3)
- No column change. `projects.org_id` is the owner; `client_id` = the responsible
  contact and **must be a member of `org_id`**.
- **Integrity guarantee:** on membership removal (`remove_org_member`), any project
  where that user is the responsible contact is **reassigned to the org's founding
  member** (never left dangling). Add a check (trigger or in the RPC) so a project's
  `client_id` is always a current member of its org. A hard FK to
  `organization_members` is impractical (composite), so enforce via the RPC +
  a validation trigger on `projects` insert/update of `client_id`.
- Project edit/create gets a "מנהל אחראי" picker of the org's members (default =
  founding member / a manager).

## client_id impact audit (spec-review #4 — a plan deliverable)

`client_id`'s meaning shifts from "owner / the user who logs in" to "per-project
responsible contact (a member, not necessarily the primary account)". The plan's
FIRST step captures and re-validates every read of `projects.client_id` (mirroring
Phase 1's policy-capture step). Known surfaces to audit:
- RLS: `projects` / `client_brand` `client_id = auth.uid()` fallbacks (Phase 1) —
  still valid since a contact is a member, but confirm.
- Notifications: Phase 2B-4 already fans to org managers (good); but
  `admin_open_service_call` and any trigger that copies `projects.client_id` into a
  child row (`service_calls.client_id`, agreements, payments) must be re-checked.
- Hooks/RPCs/admin: `useProjects`, dashboard grouping by client, `service_calls`
  filters, `client_service_summary`, ProjectHero contact display, EditProjectSheet.
- Any code that assumes "the project's client_id is THE person to email / the only
  viewer" is now wrong — it should target org members/managers.

## Demo/test at the org level (spec-review #5)

Add `organizations.kind` (`real` | `demo` | `studio`), backfilled at migration from
the founding member's email (existing `isInternalClient` / `isDemoEmail` logic). The
businesses list splits on the ORG's `kind`, not per-profile email. "Add business"
sets `kind` from the manager email.

## Add business — existing-email handling (spec-review #6)

Minimal form: business name + manager email. Before creating, the flow checks the
email:
- If it is already a profile/member of another org, surface it ("this email already
  belongs to / manages business X") and require explicit confirmation — do NOT
  silently create a second-org membership (the multi-org-without-switcher pitfall
  flagged in the Phase-1 spec).
- Otherwise create the org (+ `kind`), whitelist the manager, and queue their
  membership (materialized on first Google login) via the Phase-2B machinery.

## Admin UI

### Businesses list (was "לקוחות")
- Source: `organizations`. A pure member never appears as its own row. Compact
  sortable table: business name, # members, # projects, last activity, status.
  Split by `organizations.kind` (real / demo / studio). "הוסף עסק" = the guarded
  add-business flow above.

### Business detail (extends today's ClientDetail)
- Header: business name + org brand.
- Members: the Phase-2B `OrgMembersSection` (built) — add/remove, caps, presets,
  pending, invite requests.
- Projects: all org projects (compact table), each with its responsible contact +
  a picker to (re)assign.
- Brand editor: edits the org brand.
- CRM: org notes (grouped by person, with `role_in_company`) + call log.
- Service / agreements: at the business level, as today.

### Client side
- Unchanged UX. Brand lookups repoint from the person to the org brand (ProjectHero,
  BrandGuidelines, client brand view). RLS already scopes projects to the org.

## Migration = archive + repoint, never destroy (spec-review #1, #2)

1. Add `organizations.kind`; backfill from founding member email.
2. Add `client_call_logs.org_id`; backfill from the client's org.
3. Emit the pre-migration brand audit (non-founding brands with real data). GATE on
   Ori's review.
4. Set each org's canonical brand = founding member's brand; archive non-founding
   member brands to `client_brand_archive` (soft, reversible).
5. Repoint frontend brand/CRM reads `client_id` → `org_id`.
6. Stop creating per-member brand rows in the auth functions.
7. Add the responsible-contact validation + reassign-on-removal.

## Known intermediate-state limitation (spec-review #7)

The plan may ship the businesses UI (list + detail scaffold) BEFORE the brand/CRM
migration, reusing the founding member's per-person brand/CRM for display. During
that window the business detail shows a single person's brand/CRM while the org may
already have multiple members with their own (as yet un-migrated) rows. This is an
intentional de-risking step, documented as a KNOWN LIMITATION — not "identical"
behavior. Each phase ships only after branch verification by role simulation.

## Non-goals (later / Phase 3+)

- Per-project member exclusion (a member removed from one project but in the org).
- Business-level referral/credits (stay per-user).
- Full client self-service team management (studio-managed remains).
- The multi-org project badge / an org switcher (relevant if #6's confirm path ever
  allows one person to manage several businesses).
- Per-manager email fan-out (a noted Phase-2B-4 follow-up).

## Sequencing (for the plan)

1. **Audit + scaffolding:** `client_id` impact audit; `organizations.kind`;
   businesses list (table) + guarded "add business" + business detail scaffold
   reusing founding-member brand/CRM (known-limitation window).
2. **Brand → org:** pre-migration audit gate → canonical brand + archive → repoint
   consumers → stop per-member brand creation.
3. **CRM → org:** `client_call_logs.org_id`; org-scoped notes+calls views.
4. **Responsible contact:** picker + validation + reassign-on-removal.

Each step keeps `tsc`/`build` green and is verified on the Supabase branch by role
simulation before prod, per the established workflow.

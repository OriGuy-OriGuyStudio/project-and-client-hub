# Org-Centric Admin ("Businesses") — Design

**Date:** 2026-07-12
**Status:** Approved (brainstorm). Next: implementation plan.
**Builds on:** Organizations multi-tenancy Phase 1 + Phase 2 (orgs, members,
capabilities, member management) — all on `staging`, `org_id` present on every
project-scoped table.

## Goal

Make the **business (organization) the first-class entity** in the admin, instead
of the individual person. Today the admin "לקוחות" page lists client *profiles*, so
an invited teammate (e.g. מרק, a member of דנה's business) shows up as a separate
"customer". The owner should instead see **businesses**, and drilling into a
business shows its **members (people), projects, brand, and CRM**. This is the
model that scales as the studio grows to many businesses each with several people
and projects.

The client side is unchanged conceptually: a member logs in and sees their
business's projects (RLS is already org-scoped); the brand they see is the
business's brand.

## Decisions (locked in brainstorm)

1. **Brand lives at the business (org) level.** One brand per business.
2. **CRM (private admin notes + call log) lives at the business level.**
3. **A project belongs to the business (org).** Each project has one **responsible
   contact** — a member of the org who is the point person for that project (this
   is the existing `projects.client_id`, re-purposed from "owner" to "per-project
   contact"; it must reference a member of the project's org).
4. **"Add business" is minimal:** business name + manager email. It creates the
   org, whitelists the manager, and queues their membership (materialized on first
   Google login) — reusing the Phase-2B add-member machinery.
5. **Admin list views (businesses, projects) are compact, sortable tables**
   (recommended for scale). The **business detail page and the whole client side
   stay card-based** (the brand aesthetic). Tables are a presentation choice, not
   load-bearing — can be adjusted without touching the data model.

## Data model changes

### Brand → organization
- `client_brand` (business_name, logo, colors reference, fonts, website, social,
  logo_fit, …) and `brand_colors` become **org-scoped**: one brand per
  organization, keyed by `org_id` (today they are keyed by `client_id`).
- **Migration:** for each org, the org's brand = the **founding manager's** current
  `client_brand` row; member brand rows are dropped. `brand_colors` re-keyed to the
  org the same way.
- `handle_new_user` / `ensure_my_profile`: a new member no longer gets their own
  brand row — they inherit the org brand. (Solo clients still get their brand,
  which is now the org brand since they are the sole manager.)
- Implementation detail (new `org_brand` table vs. re-keying `client_brand` to
  `org_id`) is left to the plan; the model is "one brand per organization".

### CRM → organization
- `admin_client_notes` + the call log become **org-scoped** (keyed by `org_id`).
- **Migration:** the founding manager's notes/calls move to the org.

### Projects
- No schema change. `projects.org_id` is the owner (already present). `client_id`
  is re-interpreted as the **responsible contact** for the project and must be a
  member of `org_id`. The project edit/create UI gets a "מנהל אחראי" picker of the
  org's members (defaults to a manager). The business detail shows every project
  `where org_id = <org>`.

### RLS
- Brand/CRM read policies move from `client_id = auth.uid()` / owner checks to
  `is_org_member(org_id)` (read) and `is_admin()` (write) — consistent with the
  Phase-1 swap. Members see their business's brand; only admins edit brand/CRM.
- Cross-tenant isolation must remain intact (a member of business A never reads
  business B's brand/CRM/projects).

## Admin UI

### Businesses list (was "לקוחות")
- Source: `organizations` (one row per business). A pure member never appears as
  its own row.
- **Compact sortable table**: business name, # members, # projects, last activity,
  status. Keep the demo/test ("טסטים דמה") vs studio vs real split.
- **"הוסף עסק"**: minimal Sheet (business name + manager email) → creates the org +
  whitelists + queues the manager membership.

### Business detail (extends today's ClientDetail)
- Header: business name + org brand.
- **Members**: the Phase-2B `OrgMembersSection` (already built) — add/remove, cap
  toggles, presets, pending members, invite requests.
- **Projects**: all org projects (compact table), each with its responsible
  contact; create/assign a responsible member.
- **Brand editor**: edits the org brand (BrandIdentityEditor, repointed to org).
- **CRM**: org notes + call log.
- **Service / agreements**: as today, at the business level.

### Client side
- Unchanged UX. Brand lookups repoint from the person's brand to the org brand
  (one line each in the brand consumers: ProjectHero, BrandGuidelines, the client's
  own brand view). RLS already scopes projects to the org.

## Migration + backward-compat (the heaviest part)

- One-time data migration: brand + colors + CRM → org (from the founding manager).
- Repoint every brand/CRM **read** in the frontend from `client_id` to `org_id`
  (brand is read in several places: ProjectHero, brand guidelines, client brand
  view, admin brand editor). This is the main refactor surface and the reason this
  is its own spec/plan rather than a reactive change.
- The auth functions stop creating per-member brand rows.

## Non-goals (later / Phase 3+)

- Per-project member exclusion (a member removed from one project but in the org).
- Business-level referral/credits (referral/credits stay per-user for now).
- Full client self-service team management (studio-managed remains).
- The multi-org project badge.
- Per-manager email fan-out (already a noted follow-up from Phase 2B-4).

## Sequencing (for the plan)

The plan may sequence this to de-risk, e.g.:
1. Businesses list (table) + "add business" + business detail scaffold reusing the
   existing per-manager brand/CRM (visible value, no migration yet).
2. Brand → org migration + repoint brand consumers.
3. CRM → org migration.
4. Project responsible-contact picker.

Each step keeps `tsc`/`build` green and is verified on the Supabase branch by role
simulation before prod, per the established workflow.

# client_id usage impact audit (org-centric admin, Task 1)

Date: 2026-07-12. Read-only audit. DB queries run against Supabase branch
`dbchappsqcsixxecxzqv` (portal-test). No migrations or code changes in this task.

## Purpose

The org-centric refactor (see `docs/superpowers/plans/2026-07-12-org-centric-admin.md`
and the design spec) makes the **organization (business)** the first-class entity.
`projects.client_id` stops being "the one person who owns/sees this project" and
becomes a per-project **"responsible contact"**: still a member of the project's
`org_id`, but no longer assumed to be the only viewer, the only notification
target, or the account the project belongs to.

This doc inventories every read/write of a project's `client_id` (frontend +
DB) and classifies each as:

- **OK** - treats `client_id` as "a member/contact"; still valid after the refactor.
- **MUST CHANGE** - assumes `client_id` is the sole viewer / sole notification
  target / the owner of the project or its data; will misbehave once an org can
  have multiple members and/or the responsible contact differs from the
  founding member.

Excluded by design (per the brief's grep filter): partner/referral/redemption/coin
client_id usages. Those belong to the separate partner-commission and
client-referral-credit systems (see CLAUDE.md), not the project/org model this
plan is refactoring.

---

## Raw results

### Frontend grep

Command (run from repo root):

```bash
grep -rn "client_id" src --include=*.ts --include=*.tsx | grep -vi "partner\|referral\|redemption\|coin"
```

156 matching lines across 33 files. Full output kept alongside this audit in the
session scratchpad; the file-level breakdown and classification is in the table
below (every file is accounted for; only the highest-signal lines are quoted).

### DB functions referencing `projects.client_id`

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%.client_id%'
  and pg_get_functiondef(p.oid) ilike '%projects%';
```

Result (6 functions):

```
clone_into_demo
get_landing_context
notify_agreement_inserted
ack_service_welcome
admin_maintenance_overview
service_preview
```

Note: this query requires the function body to mention both `.client_id` and
`projects` textually, so it does **not** catch every function that touches
`client_id` on other tables (e.g. `admin_open_service_call`, which reads
`projects.client_id` via a bare `select client_id into v_client from
public.projects` with no literal `.client_id` token, and `client_service_summary`,
a named "known suspect" that does not reference `client_id` at all - see below).
Both were pulled and read directly by name for the known-suspects list.

### DB policies referencing `client_id`

```sql
select tablename, policyname, qual from pg_policies where qual ilike '%client_id%' and schemaname in ('public','storage');
```

Result (10 policies):

| table | policy | qual |
|---|---|---|
| `brand_colors` | `brand_colors_select` | `client_id = auth.uid() OR is_admin()` |
| `partner_enrollments` | `partner_enrollments_select` | `client_id = auth.uid() OR is_admin()` |
| `partner_enrollments` | `partner_enrollments_update` | `client_id = auth.uid() OR is_admin()` |
| `credit_transactions` | `credit_transactions_select` | `client_id = auth.uid() OR is_admin()` |
| `reward_redemptions` | `reward_redemptions_select` | `client_id = auth.uid() OR is_admin()` |
| `client_feedback` | `client_feedback_select` | `client_id = auth.uid() OR is_admin()` |
| `easter_egg_claims` | `eec_select` | `client_id = auth.uid() OR is_admin()` |
| `service_agreements` | `service_agreements_client_read` | `project_id IS NOT NULL → member_can(project_id,'finance')`, else `client_id = auth.uid()` |
| `projects` | `projects_select` | `is_org_member(org_id) OR client_id = auth.uid() OR is_admin()` |
| `client_brand` | `client_brand_select` | `is_org_member(client_brand.org_id) OR client_id = auth.uid() OR is_admin()` |

Storage: no `client_id`-referencing policies found in `storage` schema.

Note the asymmetry: `projects_select` and `client_brand_select` already carry
an `is_org_member(org_id)` branch (from the already-shipped Phase 1/2 org
model) alongside the legacy `client_id = auth.uid()` fallback. **`brand_colors_select`
does not** - see "Additional findings" below, this is a live gap, not just a
future one.

`partner_enrollments`, `credit_transactions`, `reward_redemptions`,
`easter_egg_claims` are the referral/credit/partner systems - out of scope per
the brief.

---

## Known suspects (explicit resolution, as required by the brief)

### `admin_open_service_call` - OK

```sql
select client_id into v_client from public.projects where id = p_project;
insert into public.service_calls (project_id, client_id, ...) values (p_project, v_client, ...);
perform public.notify_org_managers(p_project, 'service_call', ...);
```

Copies `projects.client_id` into `service_calls.client_id`, but:
- The in-app notification already fans out via `notify_org_managers` (inserts one
  notification per `organization_members` row where `is_manager`), not to
  `client_id` alone.
- `service_calls` read access (`service_calls_client_read`) is
  `can_access_project(project_id)` - already org/capability-scoped, not
  `client_id = auth.uid()`.
- The copied `client_id` is used only as a display/attribution field (who to
  show as "the contact" for that call) in `ServiceCalls.tsx`.

No change needed. If anything, the column name is legacy but the behavior is
already correct for the org model.

### `useProjects` (`src/hooks/useProjects.ts`) - MUST CHANGE

Fetches `client_brand` keyed by `client_id` to attach `business_name`/`logo_url`/
`logo_fit` to each project row:

```ts
const clientIds = [...new Set(projects.map((p) => p.client_id))];
supabase.from("client_brand").select("client_id, business_name, logo_url, logo_fit").in("client_id", clientIds);
```

This assumes the project's brand lives on the `client_id` row specifically. Once
brand moves to the org (Task 7) and non-founding-member `client_brand` rows are
archived (Task 7), a project whose responsible contact isn't the founding member
will resolve to **no brand** here. **Fixed by Task 8** (repoint to `org_brand`/
`org_id`-keyed read). Task 7 is the prerequisite migration.

### Admin dashboard grouping by client (`src/lib/projectGroups.ts` `groupProjects`, used by `src/pages/admin/Dashboard.tsx`) - MUST CHANGE

```ts
export function groupProjects<T extends { client_id: string }>(projects: T[], clients) {
  const emailById = new Map((clients ?? []).map((c) => [c.id, c.email]));
  for (const p of projects) {
    const email = emailById.get(p.client_id);
    if (isInternalClient(email)) studio.push(p);
    else if (isDemoEmail(email)) demo.push(p);
    else client.push(p);
  }
  ...
}
```

Classifies each project as real/demo/studio by looking up **the project's
`client_id`'s email** against hardcoded email lists. This is exactly the
heuristic Task 2 (`organizations.kind`) replaces with a stored, authoritative
per-org value. It still "works" today (one org per client, 1:1), but it is the
wrong long-term source of truth and duplicates the demo/studio email lists that
Task 2's migration also has to keep in sync. **Fixed by Task 2 + Task 3**
(Businesses page groups by `organizations.kind` directly, no email heuristic,
no per-project client_id lookup).

### `client_service_summary` - audited, NOT a client_id user (false positive vs. the suspect list)

Pulled the live definition:

```sql
create function public.client_service_summary(p_project uuid) ... as $function$
begin
  if not (public.is_admin() or public.can_access_project(p_project)) then raise exception 'forbidden'; end if;
  return query
  with proj as (select p_project as id union select id from public.projects where parent_project_id = p_project and retainer_billed), ...
  -- all joins are on project_id / parent_project_id, no client_id anywhere
end;
```

This function does not reference `client_id` at all - it is entirely
`project_id`-scoped (including the retainer parent/child fan-in) and already
gates on `can_access_project`, which is org/capability-aware. **No change
needed.** (It was presumably flagged historically for its name/adjacency to the
client-facing "השירות שלך" page, not for actual `client_id` coupling.)

### ProjectHero's contact display (`src/pages/shared/ProjectDetail.tsx` "client-contact" query -> `NotifyClientProvider`/`NotifyClientButton` in `src/components/project/NotifyClient.tsx`) - OK, with a noted dependency

`ProjectHero.tsx` itself does not reference `client_id` (verified: no match in
the file). The actual "contact" flow lives one level up, in `ProjectDetail.tsx`:

```ts
const { data: client } = useQuery({
  enabled: isAdmin && !!data?.project.client_id,
  queryKey: ["client-contact", data?.project.client_id],
  queryFn: async () => supabase.from("profiles").select("full_name, email, phone").eq("id", data!.project.client_id).single(),
});
```

feeding `NotifyClientProvider`'s `contact` object (name/phone/email of
`project.client_id`), used for:
1. The in-app bell - already routed through `notify_org_managers` (org fan-out,
   confirmed by reading `NotifyClient.tsx`'s `send()`), **not** `client_id`.
2. WhatsApp / Gmail deep links - inherently 1:1 channels; they need exactly one
   phone number and one email, so showing "the responsible contact's" info here
   is correct by construction, not a sole-viewer bug.

**OK as-is.** It depends on `client_id` always pointing at a real, current org
member with valid contact info - that invariant is what **Task 12**
(responsible-contact integrity trigger) enforces going forward. No frontend
change required unless Task 12/13 change the contact's shape.

### `EditProjectSheet.tsx` - MUST CHANGE (the strongest finding in this audit)

```tsx
<Label htmlFor="ep-client">לקוח משויך</Label>
<SelectMenu ... options={activeClients.map((c) => ({ value: c.id, label: ... }))} value={draft.client_id} onChange={(v) => update("client_id", v)} />
<p className="text-xs text-muted-foreground">
  שינוי הלקוח מעביר את הפרויקט לחשבון אחר, והלקוח הקודם יפסיק לראות אותו.
</p>
```

The UI copy itself states the current (pre-refactor) assumption in plain
Hebrew: "changing the client moves the project to a different account, and the
previous client stops seeing it." `activeClients` is the full org-agnostic
client list (`useClients()`), so today this picker can re-point `client_id` to
**any** client account in the system, not just a member of the project's own
org - i.e. it currently behaves as an account-transfer control, not a
responsible-contact picker. **Fixed by Task 13** ("מנהל אחראי" picker, scoped to
`admin_org_members(org)`), gated by **Task 12**'s DB trigger (which will reject
a `client_id` that isn't a member of `org_id`).

Also flagging a second, smaller issue in the same file: the "parent project"
picker filters candidates by `p.client_id === draft.client_id` (`.filter((p) =>
p.id !== project.id && p.client_id === draft.client_id)`) to find sibling
projects for retainer linking. Once a business can have projects with
*different* responsible contacts, this filter will hide legitimate sibling
projects (or show none) for a multi-contact org. Should filter by `org_id`
instead once `Project.org_id` is used here. Not separately tracked in the
13-task plan; the Task 13 implementer should fold this in when touching this
file, or flag it as a follow-up.

---

## Full classification table

| Area / file(s) | client_id usage | Verdict | Note |
|---|---|---|---|
| `admin_open_service_call` (DB fn) | copies `projects.client_id` → `service_calls.client_id` | OK | see known-suspects above |
| `useProjects.ts` | `client_brand` lookup keyed by `client_id` | MUST CHANGE | Task 8 (Task 7 prerequisite) |
| `useProject.ts` (lines 28, 33) | `client_brand` + `brand_colors` `.eq("client_id", project.client_id)` | MUST CHANGE | Task 8; also hits the `brand_colors` RLS gap below |
| `projectGroups.ts` `groupProjects`, used by `Dashboard.tsx` | project bucketed real/demo/studio via `client_id` → email | MUST CHANGE | Task 2 + Task 3 |
| `client_service_summary` (DB fn) | none found | OK (false positive) | no change |
| `ProjectDetail.tsx` "client-contact" query + `NotifyClient.tsx` | fetch + display contact for notify/WhatsApp/email | OK | depends on Task 12 integrity |
| `EditProjectSheet.tsx` (48, 96, 183-184, 207) | "לקוח משויך" picker rewrites `projects.client_id` to any client; parent-project filter by `client_id` | MUST CHANGE | Task 13 (+ Task 12 gate); parent-filter sub-issue needs folding in or flagging separately |
| `Projects.tsx` (77, 91, 99, 152-153) | create-project client picker | MUST CHANGE | Task 13 explicitly covers "the create-project flow" |
| `useClientBrand.ts` (`useSaveClientBrand`) | upserts `client_brand`/`brand_colors` by `client_id` | MUST CHANGE | Task 7 (migration) + Task 8 (repoint the admin brand editor to write the org's primary brand row) |
| `useClientDetail.ts` (66-89) | `client_brand`, `brand_colors`, `admin_client_notes`, `client_call_logs`, `projects`, `get_client_credits`, `easter_egg_claims`, `partner_enrollments` all `.eq("client_id", id)` | MUST CHANGE (brand + CRM parts only) | brand rows → Task 8; `admin_client_notes`/`client_call_logs` → Task 10/11; `get_client_credits`/`partner_enrollments`/`easter_egg_claims` → out of scope (referral/credit system) |
| `useClientCrm.ts` | `admin_client_notes` + `client_call_logs` by `client_id` | MUST CHANGE | Task 10 (call log `org_id`) + Task 11 (org-scoped CRM hook); `admin_client_notes` already has `org_id` (schema-verified), so this is a pure frontend re-key, no new migration needed for notes |
| `useClients.ts` (44-48) | `client_brand` lookup by `client_id` for the Clients list's business-name column | MUST CHANGE | Task 8; page itself is superseded by Task 3's Businesses list |
| `Clients.tsx` (425-440) | `client_brand`/`brand_colors` upsert by `client_id` (the client "quick edit" on the Clients page) | MUST CHANGE | Task 7/8 |
| `Clients.tsx` (713) | `client_call_logs` insert without `org_id` | MUST CHANGE | Task 10 (add + backfill `org_id`, then set it on insert) |
| `Clients.tsx` (456, 458) | `partner_enrollments` insert/delete by `client_id` | OK / out of scope | referral/partner system |
| `ClientDetail.tsx` (257) | `create_landing_invite` RPC, `p_client_id: id` | OK | landing invite is inherently single-lead by design, pre-org/pre-signup flow |
| `useOrg.ts` `useClientOrgId` (8-22) | resolves a client's `org_id` by reading `client_brand.org_id` `.eq("client_id", clientId)` | MUST CHANGE (latent, not yet broken) | Once Task 9 ships (invited members no longer get a `client_brand` row), this lookup returns null for any member who isn't the org founder. Should read `organization_members.org_id where user_id = clientId` instead (the authoritative source already used elsewhere, e.g. `admin_org_members`). Not in Task 9's file list; flag for whoever implements Task 9/13 to also fix this hook, or open as its own small follow-up. |
| `TaskBoard.tsx` (230, 397-436, 856, 1033-1035, 1140-1593) | admin Kanban: per-task `client_id` for display name, `/admin/clients/:id` links, and implicit per-client grouping when a task's project changes | MUST CHANGE (latent) - needs controller | Tasks/visibility are already org-scoped via RLS (`can_access_project`), so this is not an access-control bug. But once one org can have projects with *different* responsible contacts (post-Task 13), a single business's tasks will fragment across multiple "client" buckets/links in this board instead of grouping under one business. **Not covered by Tasks 1-13** in the current plan; needs a decision on whether to fold into Task 5/11 (BusinessDetail) scope or file as a standalone follow-up. |
| `TimeReports.tsx` (244, 283, 379-421, 722) | admin time-report grouping/labels per `client_id` | Same as TaskBoard - MUST CHANGE (latent), needs controller | Same fragmentation risk once responsible contacts diverge from org membership; time-tracking isn't mentioned anywhere in the 13-task plan, so this is explicitly out of the current scope but should be tracked. |
| `useAdminTasks.ts` (118, 139, 151-283) | admin "to-do" feed: `reward_redemptions.client_id`, `client_feedback.client_id`, `service_calls.client_id`, `service_agreements.client_id`, `project_service→project.client_id` | OK | Every one of these is a genuinely person-scoped action (one redemption/one feedback message/one signed agreement belongs to exactly one person) - not a project-sole-viewer assumption. `service_calls`/`service_agreements` linkage already reasoned through above. |
| `useClientFeedback.ts` (38) | `client_name` display lookup by `f.client_id` | OK | feedback is authored by one person by design; not project-scoped at all (`client_feedback` has no `project_id` column) |
| `FeedbackDialog.tsx` (20, 36), `client/Profile.tsx` (51) | insert own feedback, `client_id: profile.id` / `user!.id` | OK | self-authored, `client_id = auth.uid()` by construction |
| `client/Service.tsx` (338) | `c.created_by !== c.client_id` (who authored a maintenance-log line: studio or the client) | OK | display-only comparison, not access control |
| `useCuriousBadge.ts`, `useMyEnrollment.ts`, `PendingRedemptionsBanner.tsx` | `.eq("client_id", user!.id / uid)` | OK | self-scoped reads of the current user's own row |
| `Discovery.tsx`, `DiscoverySession.tsx` | optional `client_id` link on a pre-project discovery/lead session | OK | discovery sessions predate a project/org; linking to an existing client is informational, not an access grant |
| `ServiceCalls.tsx` (44, 165) | `clientNameById.get(p.client_id)` / `clientId: call.client_id` for display | OK | attribution/display only; access already gated by `can_access_project` (verified via RLS above) |
| `SessionEditorSheet.tsx`, `timer-controls.tsx`, `TimerBoard.tsx`, `timer-store.ts`, `useTimeData.ts` (type) | internal admin time-tracking, `client_id` used to attribute personal-label time to a client for billing/reports | OK, out of scope | Ori-only internal tool, not part of the client/org-facing project model this plan touches |
| `dev/mock-time.ts`, `dev/ProjectsLab.tsx` | fixture data with `client_id` | OK | dev-only harnesses, stripped from the prod build |
| `types/database.ts` | `client_id` field declarations on `Project`, `ClientBrand`, `BrandColor`, `ClientCallLog`, `ClientFeedback`, etc.; `get_client_credits` RPC arg types | OK | mirrors the DB schema; no behavior here, just types. Comment/JSDoc on `Project.client_id` could be updated to say "responsible contact" once Task 12/13 land, but that's cosmetic. |
| `admin_maintenance_overview` (DB fn) | `left join profiles pr on pr.id = p.client_id` for the maintenance-overview admin table's `client_name`/`client_email` columns | OK | display-only join for an internal admin ops table, not access control |
| `get_landing_context` (DB fn) | `left join client_brand cb on cb.client_id = li.client_id` | OK today / same latent risk as `service_preview` below | landing invites are pre-signup/single-lead by design; flagged together with `service_preview` since both join `client_brand` by a bare `client_id` |
| `notify_agreement_inserted` (DB fn) | passes `NEW.client_id` to the studio-facing webhook payload | OK | administrative record-keeping (tells Ori who signed), not client-facing |
| `clone_into_demo` (DB fn) | extensively `client_id`-scoped (clones one client's brand/projects/etc. into a demo account) | OK, out of scope | dev/QA tool; would need org-awareness only if a demo business ever gets multiple members, which is not the case today |
| `service_preview` (DB fn) | `left join client_brand cb on cb.client_id = p.client_id` for the public service-preview page's `business_name` | **MUST CHANGE (new finding, not in the original suspect list)** | Task 7 will archive every `client_brand` row except the org's founding member's. Any project whose `client_id` (responsible contact) is **not** the founding member will silently lose its `business_name` here (falls back to `p.title`) the moment Task 7 ships, unless this join is repointed to `org_id`/`org_brand(org_id)`. Task 8's file list only mentions frontend files - this DB function needs the same repoint and isn't currently listed anywhere in Tasks 7-9. |

---

## Additional findings beyond the grep/SQL scope (discovered during investigation)

These surfaced while resolving the known suspects and are not literal `client_id`
grep hits, but are directly relevant to the same MUST-CHANGE class and should be
in scope for the later tasks:

1. **`brand_colors` RLS has no org path, and no `org_id` column at all**
   (schema-verified: `id, client_id, hex_value, label, role, sort_order`, nothing
   else). `client_brand_select` already has `is_org_member(client_brand.org_id)
   OR client_id = auth.uid() OR is_admin()`, but `brand_colors_select` is still
   just `client_id = auth.uid() OR is_admin()`. **Right now**, any org member
   who is not the exact `client_id` row (e.g. an invited manager viewing a
   project they didn't found) gets an **empty palette** back from
   `brand_colors` (RLS silently filters the rows, no error), even though they
   can already see the parent `client_brand` row via the org path. This is a
   live functional gap under the already-shipped Phase 1/2 org model, not just
   a future one. Task 7/8 should add an `org_id` column (or resolve via the
   `client_brand` join) and mirror the `client_brand_select` policy shape.

2. **`ack_service_welcome`** (DB fn) gates the write with `pr.client_id =
   auth.uid()` only:
   ```sql
   where ps.project_id = p_project and ps.welcome_seen_at is null
     and exists (select 1 from public.projects pr where pr.id = p_project and pr.client_id = auth.uid());
   ```
   Unlike its sibling `service_calls` (which moved to `can_access_project`),
   this one still hard-codes "only the exact responsible contact can act."
   Any other org member opening "השירות שלך" for a project where they aren't
   `client_id` will have this RPC silently no-op (no error, just no row
   updated), so the welcome banner will not dismiss for them. Not covered by
   Tasks 1-13; flag as a small follow-up migration (swap the `exists` check for
   `public.can_access_project(p_project)`, matching the `service_calls` pattern).

3. **`get_landing_context`** joins `client_brand` by a bare `client_id`, same
   shape as `service_preview` (finding above). Lower risk in practice since a
   landing invite's `client_id` is usually the founding member of a brand-new
   signup, but it is the same latent bug once Task 7 ships and should be swept
   in the same pass.

---

## Summary

- Frontend grep: 156 lines / 33 files.
- DB: 6 functions matched the literal `.client_id` + `projects` search; 2 more
  known suspects (`admin_open_service_call`, `client_service_summary`) were
  pulled by name since the query's textual match missed them; 10 RLS policies
  reference `client_id`.
- Classification count (by file/area, not by line - see table): **OK: 21
  areas** (including 4 explicitly out-of-scope referral/partner/credit areas
  and 2 dev-only areas). **MUST CHANGE: 15 areas**, of which:
  - 6 map cleanly onto existing plan tasks (Task 2, 3, 7, 8, 10, 11, 12, 13 -
    several areas map to more than one task).
  - 2 are new findings not in the original known-suspects list
    (`service_preview`'s `client_brand` join breaking post-Task-7; the
    `brand_colors` RLS gap that is *already* live, not just future).
  - 3 are latent/needs-controller items not covered by any of the 13 tasks
    (`TaskBoard.tsx`/`TimeReports.tsx` per-client grouping fragmentation risk;
    `ack_service_welcome`'s non-org-scoped gate; `useOrg.ts`'s `useClientOrgId`
    breaking once Task 9 ships).

## Open items for the plan controller

- Decide whether `service_preview`'s and `get_landing_context`'s `client_brand`
  joins get fixed inside Task 7/8 (recommended, same root cause) or as a
  separate DB follow-up task.
- Decide whether the `brand_colors` RLS gap is urgent enough to fix now
  (independent of Task 7's data migration) since it is a live bug today, not
  just a future one.
- Decide whether `TaskBoard.tsx`/`TimeReports.tsx` per-client grouping and
  `ack_service_welcome`'s access gate get folded into an existing task (5, 11,
  or 12) or filed as new follow-up tasks - they are not destructive today (no
  data loss, no cross-tenant leak) but will produce confusing/broken UX once
  Task 13 lets a responsible contact differ from the org founder or from other
  projects' contacts in the same org.
- `useOrg.ts`'s `useClientOrgId` should be fixed (read `organization_members`
  instead of `client_brand`) no later than Task 9, since Task 9 is what makes
  its current `client_brand`-based lookup start returning null for invited
  members.

# Persona Generator Implementation Plan

> **For agentic workers:** implement task-by-task. Each task ends with a build-green,
> branch-verified deliverable. Admin pages are OAuth-gated so verify via `tsc`/build +
> Supabase role-sim, not a headless browser.

**Goal:** Ship the "ארגז כלים" tab with an AI persona generator (from discovery),
editable, published to a project and shown on the client project page, with an AI portrait.

**Architecture:** generic `project_deliverables` table + one Gemini edge fn
`generate-deliverable` + admin tools UI + client project-page section. See spec
`docs/superpowers/specs/2026-07-13-tools-persona-generator-design.md`.

## Global Constraints
Hebrew/RTL; no em-dashes; brand tokens (no hex); Sheets not dialogs; RLS on the new
table (clients see published-only); work on staging, branch DB before prod; TanStack
Query hooks + invalidation.

---

### Task 1: DB foundation — `project_deliverables` table + RLS + Storage bucket + types
**Files:** Create `supabase/migrations/<ts>_project_deliverables.sql`; modify `src/types/database.ts`.
**Interfaces produced:** table `project_deliverables`; `ProjectDeliverable` TS type;
public bucket `deliverable-media`.
- Migration: create table (cols per spec), indexes, enable RLS, admin-all policy,
  client read policy (`status='published' AND public.can_access_project(project_id)`).
  Create storage bucket `deliverable-media` (public) + storage policies (public read;
  service-role/admin write).
- `database.ts`: add `ProjectDeliverable` type + `project_deliverables: TableShape<…>`.
- Verify on branch (role-sim): admin insert/select; a project org-member reads a
  published row + NOT a draft; a non-member reads nothing. tsc green.

### Task 2: `generate-deliverable` edge function (persona text + portrait)
**Files:** Create `supabase/functions/generate-deliverable/index.ts`.
**Consumes:** discovery answers for a project. **Produces:** `{ ok, persona }` with `avatar_url`.
- Admin gate + CORS mirrored from `discovery-summarize`.
- Load the project's linked discovery session answers (project_id, fallback org_id latest).
- Text: Gemini `gemini-2.5-flash` (thinking off) with `responseMimeType: application/json`
  + `responseSchema` for the persona (name/archetype/summary/age/location/traits/quote/
  goals/pains/motivations/how_we_help). Hebrew prompt with the base rules + explicit
  non-generic-name rule. Fallback models on 404.
- Image: Gemini image model → base64 → upload to `deliverable-media/personas/{project}/{uuid}.png`
  via service role → public URL into `avatar_url`. Image failure is non-fatal.
- Deploy to branch; invoke for a seeded project with a discovery session; assert JSON +
  non-generic name + resolvable avatar_url.

### Task 3: data hooks + generate lib
**Files:** Create `src/hooks/useDeliverables.ts`; add `generatePersona()` to `src/lib/invite.ts` (or a new `src/lib/deliverables.ts`).
**Produces:** `useProjectDeliverables(projectId)`, `usePublishedPersonas(projectId)`,
mutations (upsert/delete/setStatus), `generatePersona(projectId)` calling the edge fn.
- TanStack Query hooks + invalidation keys `["deliverables", projectId]`.

### Task 4: admin tools hub + persona generator/editor + nav
**Files:** Create `src/pages/admin/Tools.tsx`, `src/pages/admin/PersonaTool.tsx` (or a Sheet);
modify `src/components/layout/nav-config.ts`, `src/App.tsx` (routes).
- Nav item "ארגז כלים" (Wrench icon) in a fitting section.
- `/admin/tools` hub: card grid — active "מחולל פרסונה", "בקרוב" for מסע לקוח / מפת אתר.
- Persona flow: pick project (only those with a discovery session), "צור פרסונה (AI)",
  editable structured form (incl. avatar preview + regenerate), save, "הצג ללקוח" toggle,
  list existing personas per project (edit/delete/reorder).
- tsc + build green.

### Task 5: client project-page persona section
**Files:** modify `src/pages/shared/ProjectDetail.tsx` (+ a `PersonaSection` component).
- Render published personas as cards matching the approved mockup, themed with brand
  tokens (green accent, dark, RTL): avatar, name + archetype badge, summary, trait chips,
  quote, goals, pains, how-we-help. Hidden when there are none.
- tsc + build green; branch role-sim confirms a client sees only published personas.

---
## Ship gate
Ori QA on staging/branch → apply migration to prod + deploy edge fn to prod + create prod
bucket → merge staging→main. Then journey + sitemap tools as follow-up specs on this infra.

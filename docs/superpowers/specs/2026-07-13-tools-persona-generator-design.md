# ארגז כלים — Persona Generator (design spec)

**Date:** 2026-07-13
**Status:** approved (Ori) — MVP = persona only, AI-from-discovery + edit, with an AI portrait image.

## Goal
A new admin area **"ארגז כלים"** (`/admin/tools`) that hosts tools which save Ori
time running the studio, some of whose outputs are shown to clients. First tool:
a **Persona generator** that turns a discovery call into a client-ready persona
(with an AI-generated portrait), which Ori edits and publishes to a project so it
appears on the client's project page.

## Architecture (2-3 sentences)
A generic `project_deliverables` table (kind = persona | journey | sitemap) stores
structured `content` jsonb per deliverable, so the later journey/sitemap tools reuse
the same table, edge function, and publish-to-project flow. A single admin-gated
Gemini edge function `generate-deliverable` produces the structured draft from the
project's linked discovery-session answers (and a portrait image saved to Storage).
Published deliverables render on the client project page via an org-scoped read.

## Tech stack
React + TS + Vite, Supabase (Postgres + RLS + Storage + Edge Functions/Deno),
Google AI Studio (Gemini) reusing the existing `GEMINI_API_KEY` secret (already used
by `discovery-summarize`). App brand tokens for the UI (green #B4D670, dark/RTL).

## Global constraints (verbatim, apply to every task)
- Hebrew / RTL everywhere; no English UI text.
- **No em-dashes ("—")** in any UI copy or AI output. Use comma/period/parentheses.
- Gendered copy where the UI addresses a user (`gendered(profile?.gender, …)`); the
  persona content itself is business content, not user-addressed, so it is neutral.
- Brand tokens only (`bg-card`, `text-muted-foreground`, `bg-primary`, …), no hex.
- Add/edit uses side Sheets, not centered dialogs, per project convention.
- RLS on every table; clients never see `draft` deliverables or internal data.
- Work on `staging`; branch DB before prod; merge to main only on Ori's approval.
- Data hooks via TanStack Query; mutations invalidate their query keys.

## Data model
New table `public.project_deliverables`:
- `id uuid pk`
- `project_id uuid references projects on delete cascade`
- `org_id uuid references organizations on delete set null` (RLS scope; set from the project's org at insert)
- `kind text check (kind in ('persona','journey','sitemap'))`
- `title text` (e.g. the persona name, for list display)
- `content jsonb not null default '{}'` (structured per kind — see Persona schema)
- `status text check (status in ('draft','published')) default 'draft'`
- `sort_order int default 0`
- `created_at / updated_at timestamptz`

Indexes: `(project_id)`, `(org_id)`.

**RLS:**
- Admin: full access via `is_admin()`.
- Client read: `status = 'published' AND public.can_access_project(project_id)` —
  so every member of the project's org sees published deliverables; drafts are
  admin-only. No client write.

**Persona `content` schema (jsonb):**
```
{
  "name": string,              // realistic, NON-generic (no "יוסי כהן"/"ישראל ישראלי")
  "archetype": string,         // e.g. "היזם התעשייתי"
  "summary": string,           // 1-2 sentence role/context
  "age": string,               // free text, e.g. "בן 52"
  "location": string,          // free text
  "traits": string[],          // short chips (e.g. "מפעל בבעלות משפחתית")
  "quote": string,             // first-person quote in the persona's voice
  "goals": string[],
  "pains": string[],
  "motivations": string[],
  "how_we_help": string,       // paragraph, studio voice ("אני"/"אנחנו")
  "avatar_url": string | null  // public Storage URL of the AI portrait
}
```
Journey/sitemap schemas are defined in their own later specs; this spec only builds persona.

## AI generation — `generate-deliverable` edge function (admin-gated, Gemini)
Mirrors `discovery-summarize` (admin gate via `get_my_role`, CORS, Gemini call).
Input: `{ kind: 'persona', project_id }`. The function:
1. Loads the project's linked discovery session(s) (`discovery_sessions where project_id = …`,
   fallback: latest session for the project's `org_id`) and flattens the answers to
   `question: value` lines (ALL answers, like discovery-summarize does).
2. **Text step** — Gemini `gemini-2.5-flash` (thinking OFF), `responseMimeType: application/json`
   + a `responseSchema` matching the persona content (minus `avatar_url`). Prompt (Hebrew):
   - base rules copied from discovery-summarize (natural spoken Hebrew, no m-dash, no
     buzzwords, no invention — base only on the discovery answers).
   - **Name rule (explicit):** choose a realistic first + last name that fits the archetype
     and audience; **never** use generic placeholder names (יוסי כהן, ישראל ישראלי, דני לוי).
   - Derive the persona from the audience/goals/offer answers. If the discovery names
     more than one audience, generate the one that best matches the request (one persona
     per call; Ori can generate another).
   - Fallback models `gemini-2.0-flash` then `gemini-flash-latest` on 404 (same as sibling).
3. **Image step** — Gemini image model (`gemini-2.5-flash-image-preview`, fallback
   `imagen-3.0-generate-002`) with a portrait prompt built from the persona
   (age, role, setting; "realistic professional portrait, natural light, no text, no logo").
   Decode the returned base64 and upload to a **public** Storage bucket `deliverable-media`
   at `personas/{project_id}/{uuid}.png` using the service-role client; put the public URL
   in the returned JSON as `avatar_url`. If the image step fails, return the persona
   without an avatar (non-fatal) so text still works.
4. Returns `{ ok: true, persona: {…, avatar_url} }`. The admin edits + saves; nothing is
   written to `project_deliverables` by the function (the frontend owns the write, like
   discovery-summarize returns text the admin saves).

Storage: create bucket `deliverable-media` (public read; writes only via service role in
the edge fn). Non-sensitive AI portraits, so public read is acceptable and simplest for the
client project page.

Cost note: Ori approved stronger models; a persona is one text call + one image call,
negligible cost. `maxOutputTokens` ~1500 for text.

## Admin UI
- Nav: new item **"ארגז כלים"** (icon `Wrench` / `Hammer`), in a fitting sidebar section
  (proposed: a new short section "כלים" or under "מדדים ומערכת").
- `/admin/tools` — a **tools hub**: a grid of tool cards. MVP shows one active card
  ("מחולל פרסונה") plus a couple of "בקרוב" placeholders (מסע לקוח, מפת אתר) so the
  direction is visible.
- **Persona generator flow** (a page or a side Sheet, `/admin/tools/persona`):
  1. Pick a **project** (only projects that have a linked discovery session; show
     business + project title, disambiguated). 
  2. "צור פרסונה (AI)" → calls `generate-deliverable`, shows a spinner ("בונה פרסונה…").
  3. Editable persona form (structured fields: name, archetype, summary, age, location,
     traits chips, quote, goals[], pains[], motivations[], how_we_help, avatar preview with
     "צור תמונה מחדש").
  4. Save → inserts/updates a `project_deliverables` row (kind persona, org from project).
  5. "הצג ללקוח" toggle sets status draft/published.
  - The project's existing personas are listed for edit/delete/reorder.
- Reuse the shared table/card patterns and Sheets already in the app.

## Client display
- New section on the **project page** (`ProjectDetail`, seen by client + admin): "קהל היעד"
  rendering published personas as cards matching the approved mockup (avatar, name +
  archetype badge, summary, trait chips, quote, goals, pains, how-we-help), themed with the
  brand tokens (green accent, dark, RTL). Read via a small definer RPC or a direct
  RLS-scoped select (`project_deliverables where project_id and status='published'`).
- If a project has no published personas, the section is hidden (no empty state noise).

## Security
- `project_deliverables` RLS: admin all; client read published-only for accessible projects;
  no client write. Drafts never leave the admin.
- `generate-deliverable` is admin-gated (role check), like `discovery-summarize`.
- Storage bucket `deliverable-media` public-read, service-role write only.

## Non-goals (this spec)
- Journey and sitemap tools (same infra, later specs).
- Client-initiated generation. Clients only view published outputs.
- Editing history / versioning of deliverables.

## Testing
- Branch DB role-sim: admin can CRUD deliverables; a client member sees only published
  ones for their project and none in draft; a non-member sees none.
- Edge fn: invoke with a seeded project that has a discovery session, assert structured
  persona JSON + a non-generic name + an avatar_url that resolves.
- `tsc -b` + `npm run build` green. Admin pages are OAuth-gated → build + role-sim verified
  (no headless browser preview), consistent with the rest of the admin.

## Execution
writing-plans → subagent-driven-development, task-by-task with review, as with the prior
big features. Ship to prod only on Ori's approval after his QA on staging/branch.

# Studio Ori Guy — Client Portal (project guide for AI/devs)

Read this first. It's the handoff doc: what the app is, how it's built, and how to
continue working on it from a fresh session.

## What it is
A private, bespoke **client portal & project-management system** for a solo premium
web studio (owner: **Ori Guy**, spelled O-R-I). Entire UI is **Hebrew / RTL**, dark
by default, brand-themed (not a generic SaaS look). Three user roles:
- **admin** — Ori. Full panel: clients, projects, partners, referrals, feedback, settings.
- **client** — sees only their own projects (RLS-enforced), files, approvals, chat, and
  (if the admin approves them) the referral/credit program.
- **partner (שת"פ)** — external referrer with a commission; separate portal, no project access.

## Stack
React 18 + TypeScript + Vite · Tailwind + shadcn-style components (hand-rolled in
`src/components/ui`) · Supabase (Postgres + Auth + Storage + Realtime) · Google OAuth only ·
TanStack Query · React Router v6 · Framer Motion + GSAP (gated on `prefers-reduced-motion`) ·
TipTap + DOMPurify (rich text) · jszip (file zips) · canvas-confetti.

## Run it
```bash
npm install
npm run dev      # http://localhost:8080  (also: .claude/launch.json → "portal-dev")
npm run build    # tsc -b && vite build  (must stay green)
```
`.env` holds the Supabase URL + publishable key (gitignored). `.env.example` lists all vars.

## Supabase
- Project ref: **tirasinbjsotcrqggipe** · URL `https://tirasinbjsotcrqggipe.supabase.co`.
- Auth: Google OAuth only. The Google callback `…/auth/v1/callback` must be in the Google
  Cloud OAuth client's redirect URIs.
- Migrations live in `supabase/migrations/` (timestamped, ordered). They were applied to the
  live DB via the **Supabase MCP** (`apply_migration`). When the MCP is connected you can push
  new SQL the same way; otherwise `npx supabase db push`. Regenerate types with
  `npx supabase gen types typescript --linked > src/types/database.ts` (note: the current
  `database.ts` is hand-authored — keep it in sync if you edit the schema).
- `supabase/README.md` documents the security model in depth.

## Security model (non-negotiable — keep it intact)
- **RLS on every table.** Clients are scoped by `client_id = auth.uid()`; admins via
  `is_admin()`. `is_private` rows (files/tasks/docs) and `admin_client_notes`/CRM are blocked
  at the DB level for clients, not just hidden.
- Helper fns are `SECURITY DEFINER` (`get_my_role`, `is_admin`, `owns_project`,
  `get_client_credits`) so policies can call them without RLS recursion.
- **Profiles are created only by `handle_new_user()` / `ensure_my_profile()`** for whitelisted
  emails (`allowed_emails`). `ensure_my_profile()` runs on every login (called from
  `useAuth`) so a user whitelisted *after* their first sign-in still gets a profile.
- Money/credit integrity is enforced by triggers + definer RPCs (e.g. `redeem_reward`,
  `reverse_referral_credit`, the `guard_*` triggers that block non-admins from changing
  status/financial fields). Don't move these checks into the client.
- Storage bucket `project-files` is private; downloads only via 1-hour signed URLs.

## Conventions
- **Hebrew everywhere** — labels, errors, empty states, toasts. No English UI text.
- **Gendered copy** — Hebrew UI text addressed to a user must adapt to their gender
  (male/female), never masculine-only. Use `gendered(profile?.gender, "<m>", "<f>")`
  from `src/lib/gender.ts` (`profile.gender` from `useAuth`, masculine fallback) for the
  forms that differ (present-tense verbs, adjectives, אתה/את). Every new screen supports
  זכר/נקבה from day one. Admin-authored DB content (reward names, etc.) is the exception.
- **RTL is real** — use logical props; the sidebar is on the right; sheets slide from the
  inline-start; progress fills right→left.
- **Design tokens** in `src/styles/brand-tokens.css` (light `:root` + dark `.dark`). Use
  semantic Tailwind colors (`bg-card`, `text-muted-foreground`, `bg-primary`…), not hex.
  Green `#B4D670` is the single signature accent.
- Fonts: headings = `Kaha`, body = `Diplomat` (local, in `public/fonts`).
- **Add/edit modals are side Sheets** (`components/ui/sheet.tsx`), never centered dialogs.
- Data via TanStack Query hooks in `src/hooks`. Mutations call `supabase` then
  `qc.invalidateQueries`. Realtime channels must use **unique names** per subscription.
- Verify DB-dependent work by simulating a role through the Supabase MCP:
  `select set_config('request.jwt.claims', '{"sub":"<uid>"}', false); set role authenticated; …`
  Always clean up test rows afterward.

## Where things are
```
src/
  pages/{auth,admin,client,partner,shared}   # routed screens
  components/{ui,layout,project,brand,files,chat,ai-widget,tasks,payments,partner}
  hooks/                                      # useAuth, useProject(s), useNotifications, …
  lib/{supabase,auth,sanitize,files,confetti,status,activity}.ts
  styles/{brand-tokens,fonts}.css
  types/database.ts                           # hand-authored Supabase types
supabase/migrations/                          # ordered SQL (source of truth)
```
Routing: client home = `/`; admin = `/admin/*`; partner = `/partner-portal/*`. Three logins:
`/login`, `/admin/login`, `/partner-portal/login`. Guards + role→home logic in
`components/auth/guards.tsx`.

## Current state
Built & working: auth+whitelist, brand/RTL/themes, full Project Detail page (hero, brand
guidelines, roadmap, approvals, checklist, tasks, files w/ folders+zip, TipTap docs, payments,
warranty, activity, chat), admin create/edit/delete clients (+CRM, call log, detail page) and
projects, partner role + portal + admin lead management, client referral/credit program
(gamified) gated behind admin approval, notifications + badges, client feedback loop.

Deferred backlog: admin **Settings** page (studio branding, default stage templates, WhatsApp,
warranty-email template, partner-resources mgmt); brand-identity editing UI (admin sets a
client's logo/colors); warranty-expiry **Edge Function** (pg_cron + Resend + CRON_SECRET);
external `/ref/:code` landing + tracking; partner quote-PDF upload; code-splitting.

## Note for a brand-new chat
A new **Claude Code** session opened in this folder auto-loads the memory at
`~/.claude/projects/.../memory/` plus this `CLAUDE.md`, so it starts with context. For any
other tool, point it at this file + `supabase/README.md` + `supabase/migrations/`.

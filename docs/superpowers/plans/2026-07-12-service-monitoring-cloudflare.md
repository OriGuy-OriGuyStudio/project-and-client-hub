# Service Monitoring + Cloudflare Ingestion + Admin Mirror + Clients Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the client "השירות שלך" page into a real, visual-over-time
monitoring dashboard fed by an automatic Cloudflare pipeline (security + traffic +
Turnstile + backups), give the admin a read-only mirror of exactly what each
client sees, and convert `/admin/clients` to a table.

**Architecture:** A daily edge function pulls Cloudflare GraphQL analytics per
client zone into the existing `site_metrics` table (which already backs the client
charts). New typed columns hold the CF metrics. The client page reuses the existing
`PerfChart`/tile components, tier-gated. The admin mirror reuses `Service.tsx`'s
existing `preview` mode. Spec:
`docs/superpowers/specs/2026-07-12-service-monitoring-cloudflare-design.md`.

**Tech Stack:** Supabase Postgres + RLS + edge functions (Deno) + pg_cron + pg_net
(via Supabase MCP `apply_migration` / `deploy_edge_function`), Cloudflare GraphQL
Analytics API, React 18 + TS + Vite + TanStack Query + recharts, Hebrew/RTL.

## Global Constraints

- Apply every migration to branch `dbchappsqcsixxecxzqv` FIRST; verify by role
  simulation; deploy edge fns to that branch. Prod `tirasinbjsotcrqggipe` only after
  Ori QA. Git `staging`; never merge to `main` without Ori's approval.
- The Cloudflare API token is a definer/admin-only secret (`webhook_secrets`
  `cloudflare_api_token`), never sent to the client or the frontend. Ingestion runs
  server-side (edge fn, service role).
- `site_metrics` client reads stay project-scoped (`can_access_project`); new
  columns inherit the table's RLS. No new client-writable surface.
- Honesty-preserving: never fabricate a client-facing metric. No data for a project
  → show "בקרוב" or omit; never a fake value. Trend chips only with enough history.
- Frontend keeps `npx tsc -b` + `npm run build` green. Hebrew/RTL, gendered copy via
  `gendered(profile?.gender, ...)`, **no em-dashes** ("—") in UI copy, semantic
  Tailwind tokens, side Sheets for add/edit.
- No unit-test suite: DB tasks verify by role simulation (documented queries +
  expected results); edge-fn tasks by deploy + structural check (+ a real invoke
  during Ori QA); frontend tasks by `tsc`/`build` green. UI behavior is Ori QA
  (state it, do not claim visual verification).
- Every DB migration ends with `notify pgrst, 'reload schema';`.

## File Structure

- `supabase/migrations/*` — new timestamped migrations (schema, backups RPC + cron,
  CF pull cron).
- `supabase/functions/pull-cloudflare-metrics/index.ts` (new) — the CF ingestion.
- `src/types/database.ts` — `ProjectService` (cf_zone_id, cf_zone_checked_at) +
  `SiteMetric` (turnstile_solved/blocked, requests, cached_requests, bytes) + new
  RPC signatures.
- `src/components/service/PerfChart.tsx` — reused as-is (no change expected).
- `src/pages/client/Service.tsx` — new charts/tiles + tier gating + package feature
  copy.
- `src/pages/shared/PackagesLanding.tsx` (or wherever package feature lists live) —
  feature copy.
- `src/pages/admin/ServiceMirror.tsx` (new) + a route + an entry button
  (`EditProjectSheet` / maintenance card).
- `src/hooks/useService.ts` — `refreshSiteMetrics` already exists; add an admin
  mirror data hook if needed.
- `src/pages/admin/Clients.tsx` — cards → table.

---

# Phase A — Data model

### Task 1: Schema + types (zone id, CF metric columns, secret)

**Files:** Create `supabase/migrations/<ts>_cf_metrics_schema.sql`; modify
`src/types/database.ts`.

**Interfaces:**
- Produces: `project_service.cf_zone_id text`, `project_service.cf_zone_checked_at
  timestamptz`; `site_metrics.turnstile_solved int`, `turnstile_blocked int`,
  `requests bigint`, `cached_requests bigint`, `bytes bigint`. Frontend
  `ProjectService.cf_zone_id: string | null`, `cf_zone_checked_at: string | null`;
  `SiteMetric.turnstile_solved/turnstile_blocked/requests/cached_requests/bytes:
  number | null`.

- [ ] **Step 1: Write the migration.**

```sql
alter table public.project_service
  add column if not exists cf_zone_id text,
  add column if not exists cf_zone_checked_at timestamptz;

alter table public.site_metrics
  add column if not exists turnstile_solved integer,
  add column if not exists turnstile_blocked integer,
  add column if not exists requests bigint,
  add column if not exists cached_requests bigint,
  add column if not exists bytes bigint;

notify pgrst, 'reload schema';
```

- [ ] **Step 2:** Apply to branch (MCP `apply_migration`, name `cf_metrics_schema`,
  project_id `dbchappsqcsixxecxzqv`). Expect `{"success": true}`.
- [ ] **Step 3: Verify** (read as admin): the 5 new `site_metrics` columns + the 2
  `project_service` columns exist:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='site_metrics'
  and column_name in ('turnstile_solved','turnstile_blocked','requests','cached_requests','bytes');
select column_name from information_schema.columns
where table_schema='public' and table_name='project_service'
  and column_name in ('cf_zone_id','cf_zone_checked_at');
```
Expected: 5 rows then 2 rows.
- [ ] **Step 4: Verify RLS unchanged** (role-sim a client): a client still reads
  their own `site_metrics` (including new columns, null) and CANNOT read
  `webhook_secrets`. Document the queries + that the client gets 0 rows from
  `webhook_secrets` and >0 own metrics rows.
- [ ] **Step 5:** `database.ts`: add the fields to `ProjectService` and `SiteMetric`
  (hand-authored; edit by hand). Run `npx tsc -b` (exit 0).
- [ ] **Step 6: Commit** (migration + database.ts). Message:
  `feat(service): CF-metric columns on site_metrics + cf_zone_id on project_service`.

---

# Phase B — Cloudflare ingestion

### Task 2: `pull-cloudflare-metrics` edge function

**Files:** Create `supabase/functions/pull-cloudflare-metrics/index.ts`.

**Interfaces:**
- Consumes: `webhook_secrets['cloudflare_api_token']`; `project_service`
  (`project_id, active, site_url, cf_zone_id`).
- Produces: an HTTP edge function (POST, verify_jwt off — internal/cron + admin) that
  upserts daily rows into `site_metrics`. Optional body `{ project_id }` limits to one
  project; empty body processes all active packages.

- [ ] **Step 1: Write the function.** Structure (Deno, mirrors the existing mailers'
  secret-fetch pattern; use the service role client):

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
const CF = "https://api.cloudflare.com/client/v4";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-webhook-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const domainOf = (url: string) => { try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return null; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sec } = await admin.from("webhook_secrets").select("value").eq("name", "cloudflare_api_token").maybeSingle();
  const token = sec?.value;
  if (!token) return json({ ok: false, error: "no cloudflare_api_token" }, 400);

  const body = await req.json().catch(() => ({}));
  let q = admin.from("project_service").select("project_id, site_url, cf_zone_id, active").eq("active", true);
  if (body.project_id) q = q.eq("project_id", body.project_id);
  const { data: pkgs } = await q;
  const results: Record<string, string> = {};

  for (const p of pkgs ?? []) {
    const domain = domainOf(p.site_url ?? "");
    if (!domain) { results[p.project_id] = "no domain"; continue; }
    // resolve zone if missing
    let zone = p.cf_zone_id;
    if (!zone) {
      const zr = await fetch(`${CF}/zones?name=${encodeURIComponent(domain)}&status=active`, { headers: { Authorization: `Bearer ${token}` } });
      const zj = await zr.json();
      zone = zj?.result?.[0]?.id ?? null;
      await admin.from("project_service").update({ cf_zone_id: zone, cf_zone_checked_at: new Date().toISOString() }).eq("project_id", p.project_id);
      if (!zone) { results[p.project_id] = "zone not found"; continue; }
    }
    // pull last 3 days of httpRequests1dGroups
    const since = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const gql = { query: `query($zone:String!,$since:Date!,$until:Date!){viewer{zones(filter:{zoneTag:$zone}){httpRequests1dGroups(limit:10,filter:{date_geq:$since,date_leq:$until},orderBy:[date_ASC]){dimensions{date} uniq{uniques} sum{requests cachedRequests bytes threats}}}}}`, variables: { zone, since, until } };
    const gr = await fetch(`${CF}/graphql`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(gql) });
    const gj = await gr.json();
    const groups = gj?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    for (const g of groups) {
      const row = {
        project_id: p.project_id,
        metric_date: g.dimensions.date,
        requests: g.sum.requests ?? null,
        cached_requests: g.sum.cachedRequests ?? null,
        bytes: g.sum.bytes ?? null,
        threats_blocked: g.sum.threats ?? null,
        visitors: g.uniq?.uniques ?? null,
      };
      // upsert without clobbering webhook-pushed non-null values: fetch existing, merge
      const { data: existing } = await admin.from("site_metrics").select("*").eq("project_id", p.project_id).eq("metric_date", row.metric_date).maybeSingle();
      const merged = { ...row };
      if (existing) for (const k of Object.keys(row)) if (row[k] == null && existing[k] != null) merged[k] = existing[k];
      await admin.from("site_metrics").upsert(merged, { onConflict: "project_id,metric_date" });
    }
    // Turnstile: probe the account/zone Turnstile analytics dataset; if the query
    // errors or returns nothing, leave turnstile_* null (UI shows בקרוב). Attempt:
    //   turnstileAnalyticsAdaptiveGroups (may be unavailable on Free) -> upsert
    //   turnstile_solved / turnstile_blocked per date the same way.
    results[p.project_id] = `${groups.length} days`;
  }
  return json({ ok: true, results });
});
```

- [ ] **Step 2: Deploy** to the branch (MCP `deploy_edge_function`, name
  `pull-cloudflare-metrics`, project_id `dbchappsqcsixxecxzqv`, verify_jwt=false).
- [ ] **Step 3: Verify (structural + safe).** With no `cloudflare_api_token` set yet,
  a POST returns `{ ok:false, error:"no cloudflare_api_token" }` (400). Confirm via
  `get_edge_function` that it deployed. A real-token/real-zone invoke that lands real
  CF numbers (and resolves the Turnstile-availability risk) is done during **Ori QA**
  once he adds the token + a zoned domain. Do NOT fabricate a token.
- [ ] **Step 4: Commit** (the function). Message:
  `feat(service): pull-cloudflare-metrics edge fn (zone resolve + GraphQL upsert)`.

### Task 3: Daily schedule + manual admin refresh

**Files:** Create `supabase/migrations/<ts>_cf_pull_cron.sql`; modify
`src/hooks/useService.ts` (already has `refreshSiteMetrics`) + a "רענן נתונים" admin
button (maintenance page / `EditProjectSheet`).

**Interfaces:**
- Consumes: the `pull-cloudflare-metrics` function URL; `refreshSiteMetrics(projectId?)`
  already exists (`supabase.functions.invoke("poll-site-metrics", ...)`) — add an
  invoke of `pull-cloudflare-metrics`.

- [ ] **Step 1: Migration** — schedule a daily pg_cron job that invokes the function
  via `pg_net`. Confirm `pg_cron` + `pg_net` are enabled (they are used by warranty
  reminders per the codebase; if not, `create extension`). Store the function URL +
  service key from a definer helper or a `webhook_secrets` row; follow the existing
  cron pattern (grep an existing `cron.schedule` migration for the exact
  `net.http_post` shape used in this project, and copy it). Job name
  `cf_pull_daily`, schedule `20 3 * * *` (03:20, after the R2 backup at 03:15).
  End with `notify pgrst, 'reload schema';`.
- [ ] **Step 2:** Apply to branch; verify the job exists:
  `select jobname, schedule from cron.job where jobname='cf_pull_daily';` → 1 row.
- [ ] **Step 3:** `useService.ts`: add
  `export async function pullCloudflare(projectId?: string) { return supabase.functions.invoke("pull-cloudflare-metrics", { body: projectId ? { project_id: projectId } : {} }); }`.
- [ ] **Step 4:** Add an admin "רענן נתונים מ-Cloudflare" button (on the maintenance
  card or `EditProjectSheet` service section) calling `pullCloudflare(project.id)`
  then invalidating `["site-metrics", project.id]`. `tsc`/`build` green.
- [ ] **Step 5: Commit.** Message: `feat(service): daily CF pull cron + manual admin refresh`.

### Task 4: Nightly per-project backup log (makes "automatic backups" real)

**Files:** Create `supabase/migrations/<ts>_nightly_backups.sql`.

**Interfaces:**
- Produces: definer RPC `log_nightly_backups()` (admin/cron) that inserts one
  `maintenance_log` row (`kind='backup'`) per active package per day (idempotent per
  day), representing the nightly automated backup. The client backups tile/chart
  already read `maintenance_log` kind=`backup`.

- [ ] **Step 1: Migration.**

```sql
create or replace function public.log_nightly_backups()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare v_n integer;
begin
  insert into public.maintenance_log (project_id, kind, title, occurred_at)
  select ps.project_id, 'backup', 'גיבוי אוטומטי', now()
  from public.project_service ps
  where ps.active
    and not exists (
      select 1 from public.maintenance_log ml
      where ml.project_id = ps.project_id and ml.kind = 'backup'
        and ml.occurred_at::date = now()::date);
  get diagnostics v_n = row_count;
  return v_n;
end; $function$;
revoke execute on function public.log_nightly_backups() from public;
notify pgrst, 'reload schema';
```
(Confirm `maintenance_log`'s exact columns before finalizing — adjust the insert to
its real column set; `kind`/`title`/`occurred_at`/`project_id` are used by the
existing service page.) Then schedule it daily via pg_cron (job `nightly_backups`,
`10 3 * * *`), same cron pattern as Task 3.

- [ ] **Step 2:** Apply to branch. Verify: `select public.log_nightly_backups();`
  returns the active-package count on first run and `0` on an immediate second run
  (idempotent per day). Clean up the test rows you inserted (delete today's
  `kind='backup'` rows you created) OR note they are legitimate and leave them.
  Document the counts.
- [ ] **Step 3: Commit.** Message: `feat(service): nightly per-project backup log + cron`.

---

# Phase C — Client charts + package copy

### Task 5: Client service page — new charts, tiles, tier gating

**Files:** Modify `src/pages/client/Service.tsx` (reuse
`src/components/service/PerfChart.tsx`).

**Interfaces:**
- Consumes: `useSiteMetrics(projectId, 30)` → `SiteMetric[]` (now incl.
  turnstile_*/requests/cached_requests/bytes/threats_blocked); `PerfChart` props
  `{ metrics, field, color, name, domain?, height? }`; `project_service.tier`
  (core|pro|ultra).

- [ ] **Step 1: Tier map.** Add a helper: `core` shows performance + uptime +
  backups; `pro` adds Turnstile + threats/firewall + traffic/requests; `ultra` =
  everything in pro. Gate each new chart/tile on the project's `tier`.
- [ ] **Step 2: Add charts/tiles** reusing the existing `PerfChart` + `Metric` tile
  patterns already in `Service.tsx`:
  - Turnstile blocks: tile (`latest.turnstile_blocked`) + `PerfChart field="turnstile_blocked"`.
  - Threats/firewall: tile (`latest.threats_blocked`) + `PerfChart field="threats_blocked"`.
  - Traffic/requests: tile (`latest.requests`) + `PerfChart field="requests"` (+ optional cache-hit % = cached_requests/requests).
  - Backups: `PerfChart` of the per-day backup count derived from the `log`/summary
    the page already loads (backups tile already exists).
  Every metric with no data for the project renders "בקרוב" (reuse the existing
  "בקרוב" fallback already used for threats/uptime), never a fake value.
- [ ] **Step 3:** `npx tsc -b` + `npm run build` green.
- [ ] **Step 4: Commit.** Message: `feat(service): CF/Turnstile/traffic/backup charts + tier gating on service page`.
  (Ori QA: a Pro package shows security + traffic charts; a core package does not;
  no-data metrics show "בקרוב".)

### Task 6: Package feature-list copy

**Files:** Modify `src/pages/client/Service.tsx` (the tier feature arrays) +
`src/pages/shared/PackagesLanding.tsx` (or wherever the tier feature lists render).

- [ ] **Step 1:** Update each tier's feature list so it names the monitoring it
  includes, matching Task 5's gating (e.g. Pro adds "לוח ניטור אבטחה ותעבורה בזמן
  אמת, חסימות בוטים ואיומים, גיבויים אוטומטיים"). Hebrew/RTL, gendered where
  addressed, no em-dashes. Grep for the existing tier feature arrays first (the
  strings like "ניטור, אבטחה וגיבויים אוטומטיים 24/7") and edit in place.
- [ ] **Step 2:** `tsc`/`build` green. **Commit.** Message:
  `feat(service): package feature lists mention the monitoring dashboard`.

---

# Phase D — Admin mirror

### Task 7: Admin "צפה כלקוח" mirror of the service page

**Files:** Create `src/pages/admin/ServiceMirror.tsx`; modify `src/App.tsx` (route);
add an entry button (maintenance card / `EditProjectSheet`).

**Interfaces:**
- Consumes: `Service.tsx`'s existing `preview?: { metrics, log, summary }` prop; admin
  RLS lets the admin read `site_metrics`/`maintenance_log`/`project_service` for any
  project; `useSiteMetrics`, `useMaintenanceLog`, `useServiceSummary` already exist.

- [ ] **Step 1:** `ServiceMirror.tsx`: an admin-gated page at
  `/admin/maintenance/:projectId/view` that loads the project's metrics/log/summary
  (admin RLS) and renders the client `Service` component in its `preview` mode
  (read-only, no service-call/ack buttons), so "what Ori sees == what the client
  sees". If the `Service` component needs a small `readOnly`/`preview` prop to hide
  client-only actions, add it (it already accepts `preview`).
- [ ] **Step 2:** `App.tsx`: add the lazy import + `<Route
  path="/admin/maintenance/:projectId/view" element={<ServiceMirror />} />` inside
  the admin `RequireAdmin` block.
- [ ] **Step 3:** Add a "צפה כלקוח" button on the maintenance card (and/or
  `EditProjectSheet` service section) linking to that route.
- [ ] **Step 4:** `tsc`/`build` green. **Commit.** Message:
  `feat(admin): view-as-client mirror of the service page`.
  (Ori QA: opening the mirror shows exactly the client's dashboard, read-only.)

---

# Phase E — Clients table

### Task 8: Convert `/admin/clients` to a table

**Files:** Modify `src/pages/admin/Clients.tsx`.

**Interfaces:**
- Consumes: the same client data the page already loads (`useClients`); mirror the
  Businesses page table style (`src/pages/admin/Businesses.tsx`).

- [ ] **Step 1:** Replace the card grid with a compact sortable table (columns: name,
  contact/email, projects, last activity), keeping the existing real / demo (amber
  "טסטים (דמה)") / studio split and the row → client-detail link. Reuse the table
  markup/《header》pattern from `Businesses.tsx`. No data-layer change; presentation
  only. Keep any existing add-client action.
- [ ] **Step 2:** `tsc`/`build` green. **Commit.** Message:
  `feat(admin): clients page as a table`.

---

## Ship gate (after branch QA + Ori)

- Ori adds `cloudflare_api_token` to prod `webhook_secrets` + confirms each client
  domain is a zone in his CF account.
- Apply the migrations to prod in order; deploy `pull-cloudflare-metrics` + the
  redeployed mailers to prod; schedule the two crons on prod.
- Update prod `studio_settings.studio_name = 'Ori Guy Studio'` (from the email fix).
- Verify a real CF pull lands real numbers for one zoned project; then merge
  staging → main.

## Not in this plan

Building Ori's n8n flows; per-site (WordPress file) backup infrastructure; historical
backfill of CF data before ingestion starts; threshold alerting; Turnstile if the CF
API doesn't expose it (falls back to "בקרוב").

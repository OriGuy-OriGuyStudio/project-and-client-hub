# Service Monitoring + Cloudflare Ingestion + Admin Mirror + Clients Table — Design

**Goal:** Make the client "השירות שלך" page a real, visual-over-time monitoring
dashboard (Cloudflare security + traffic, Turnstile bot blocks, automatic
backups, plus the existing performance/uptime), fed by a real Cloudflare data
pipeline; give the admin a read-only mirror of exactly what each client sees;
and convert the admin `/admin/clients` page from cards to a table.

Owner: Ori Guy (solo studio). App: React 18 + TS + Vite + Tailwind + shadcn-style
+ Supabase, Hebrew/RTL, dark brand theme. This builds on the just-shipped
org-centric admin work.

## Global constraints (binding)

- DB changes apply to the Supabase **branch `dbchappsqcsixxecxzqv`** first, verified
  by role simulation; prod `tirasinbjsotcrqggipe` only after Ori QA. Git `staging`;
  never merge to `main` without Ori's approval.
- Hebrew/RTL, gendered copy via `gendered(profile?.gender, ...)`, **no em-dashes**
  ("—") in UI copy, semantic Tailwind tokens, side Sheets for add/edit.
- RLS intact: `site_metrics` reads stay project-scoped (client sees own via
  `can_access_project`); the Cloudflare API token is an admin/definer-only secret
  (`webhook_secrets`), never exposed to clients. The admin mirror uses admin RLS.
- Frontend keeps `npx tsc -b` + `npm run build` green. No unit-test suite: DB via
  role-sim, frontend via tsc/build, behavior via Ori QA (stated, not claimed).
- Every migration ends with `notify pgrst, 'reload schema';`.
- **Honesty-preserving** (house rule for client-facing numbers): never fabricate a
  metric. If a data source is unavailable for a project, show "בקרוב"/omit, never a
  fake value. Trend chips only when enough history exists.

## Existing building blocks (reused, not rebuilt)

- `site_metrics` (per project, per `metric_date`): `visitors, pageviews, sessions,
  pagespeed, lcp_ms, cls, inp_ms, uptime_pct, threats_blocked, meta jsonb`. Fed by
  the `ingest-site-metrics` webhook (shared-secret POST; any source can push).
- `PerfChart` (`src/components/service/PerfChart.tsx`) — recharts area/line chart,
  props `{ metrics, field, color, name, domain?, height? }`. Already used on the
  service page for pagespeed + visitors.
- Client service page `src/pages/client/Service.tsx` — tiles (backups from
  `maintenance_log` kind=`backup`, threats, uptime) + PerfCharts + tier feature
  lists. It already accepts a `preview?: { metrics, log, summary }` prop (used by the
  tokenized `service_preview` RPC), which the admin mirror reuses.
- `project_service` (the package) + `admin_maintenance_overview` RPC (admin table).
- `maintenance_log` (kind ∈ update/backup/scan/service_call...) — the existing
  backups source.

---

## Component 1 — Data model

Migration(s) on the branch:

- `project_service.cf_zone_id text` + `cf_zone_checked_at timestamptz` — the
  Cloudflare zone id for the project's site. Auto-resolved from the site domain
  (see Component 2); admin-overridable in the package editor.
- `site_metrics` new typed columns (nullable ints/bigint): `turnstile_solved`,
  `turnstile_blocked`, `requests`, `cached_requests`, `bytes`. `threats_blocked`
  already exists and is reused for Cloudflare firewall/threat blocks. `meta` jsonb
  stays for anything not worth a column.
- `webhook_secrets` row `cloudflare_api_token` (admin/definer-only; RLS already
  blocks clients from `webhook_secrets`).

`ProjectService` and `SiteMetric` types in the hand-authored `database.ts` gain the
new fields.

## Component 2 — Cloudflare ingestion

New edge function `pull-cloudflare-metrics` (verify_jwt off; internal/cron + admin
invoke). For each **active** `project_service` with a site domain:

1. **Resolve the zone** if `cf_zone_id` is null: `GET
   https://api.cloudflare.com/client/v4/zones?name=<domain>` with the account
   token, store the id + `cf_zone_checked_at`. Skip (graceful) if the domain isn't
   a zone in the account.
2. **Pull yesterday+today** from the CF GraphQL Analytics API
   (`https://api.cloudflare.com/client/v4/graphql`, `Authorization: Bearer <token>`):
   - `httpRequests1dGroups` (or `httpRequestsAdaptiveGroups`) → `requests`,
     `cachedRequests`, `bytes`, `threats` per date.
   - `firewallEventsAdaptiveGroups` → blocked/challenged events (feeds
     `threats_blocked` if richer than the httpRequests `threats`).
   - **Turnstile**: the Turnstile analytics dataset (`turnstileAnalyticsAdaptiveGroups`
     or the account-level Turnstile analytics) → `turnstile_solved`,
     `turnstile_blocked`. **RISK:** this dataset may be limited/absent on the Free
     plan. The function probes it and, if unavailable, leaves the columns null (UI
     shows "בקרוב" for Turnstile) — everything else still ingests. This risk is
     resolved empirically during implementation against Ori's real token/zone.
3. **Upsert** into `site_metrics` (on conflict `(project_id, metric_date)`), merging
   with whatever the `ingest-site-metrics` webhook also pushed (never clobber a
   non-null field with null).

**Schedule:** a `pg_cron` daily job invokes the function via `pg_net` (self-contained,
no external dependency), plus a manual "רענן נתונים" trigger in the admin
(`refreshSiteMetrics`-style). Token + secret resolution mirror the existing mailer
edge functions.

**Required token scopes (Ori provides at ship):** Zone → Analytics:Read,
Zone → Zone:Read (to resolve zone by name), Account → Turnstile:Read. Ori's existing
full-permission token covers these.

## Component 3 — Backups source

The backups graph is sourced from `maintenance_log` kind=`backup` per project (the
same source the current "גיבויים" tile uses), aggregated over time. Ori's backup
automation logs one event per project per real backup. The nightly R2 DB-backup
GitHub Action can additionally POST a `backup` log event per active project to
`ingest-site-metrics`, so the client-facing "automatic backups" count reflects the
real nightly cadence. (The R2 bucket itself is the *portal DB* backup, not a
per-client site backup, so it is not used directly as a per-client number.)

## Component 4 — Client "השירות שלך" charts + tier gating

Add PerfChart-based charts (over time) + tiles for the new metrics, reusing the
existing chart/tile components and the honesty rules:

- **Turnstile blocks** (bots stopped) — tile + chart.
- **Threats / firewall blocked** — tile + chart (from `threats_blocked`).
- **Traffic / requests** — requests served + cache-hit, chart.
- **Backups** — count over time (chart), alongside the existing tile.
- Existing PageSpeed / uptime / visitors stay.

**Tier gating** (`project_service.tier` ∈ core/pro/ultra), per Ori:
- **core:** PageSpeed + uptime + backups.
- **pro:** core + Turnstile + threats/firewall + **traffic/requests** (most clients
  are Pro, so Pro is the "full security + traffic" tier).
- **ultra:** everything in pro (+ any future granular/longer-history extras).

A metric with no data for a project shows "בקרוב", never a fake value.

## Component 5 — Package feature lists

Update the tier feature descriptions (the arrays in `Service.tsx` and the
`PackagesLanding` page) so each tier's marketing feature list mentions the
monitoring it includes, matching the gating above (e.g. Pro lists "לוח ניטור
אבטחה ותעבורה בזמן אמת, חסימות בוטים ואיומים, גיבויים אוטומטיים"). Copy is
Hebrew/RTL, gendered where addressed, no em-dashes.

## Component 6 — Admin mirror ("צפה כלקוח")

A read-only admin view that renders the **exact** client service page per project,
so "what Ori sees == what the client sees". Reuses `Service.tsx` in its existing
`preview` mode, fed by an admin-readable data path (admin RLS already lets the admin
read `site_metrics`/`maintenance_log`/`project_service` for any project; the
existing `service_preview` RPC or a thin admin fetch supplies `{ metrics, log,
summary }`). Entry points: a "צפה כלקוח" button on the maintenance card /
`EditProjectSheet` / the package section, opening the mirror (route e.g.
`/admin/maintenance/:projectId/view` or a sheet/modal). No writes.

## Component 7 — Clients table

Convert `/admin/clients` (`src/pages/admin/Clients.tsx`) from cards to a compact
sortable table, matching the new Businesses page style (name, contact, projects,
last activity), keeping the demo/studio (amber) split. Row → the client detail
page. No behavior change to the underlying data; presentation only.

---

## Security / privacy

- The Cloudflare token lives only in `webhook_secrets` (definer/admin access);
  never sent to the client or embedded in frontend. The ingestion runs
  server-side (edge fn) with the service role.
- `site_metrics` client reads remain project-scoped (`can_access_project`); the new
  columns inherit the table's existing RLS. No new client-writable surface.
- The admin mirror is admin-gated (RequireAdmin route) and read-only.
- Turnstile/CF data is aggregate per zone (counts), not PII.

## Verification

- DB: role-sim on the branch (client reads own metrics incl. new columns; client
  cannot read `webhook_secrets`/another project's metrics; `pull-cloudflare-metrics`
  upserts correctly for a test zone; `cf_zone_id` resolution).
- Edge fn: deploy to the branch; a manual invoke against Ori's real token/zone
  during QA confirms real CF numbers land (Turnstile risk resolved here).
- Frontend: `tsc -b` + `build` green; chart/tile rendering + tier gating + the admin
  mirror are Ori QA (state it, do not claim visual verification).

## What Ori provides (at ship, not during branch build)

- The Cloudflare API token (scopes above) stored as `cloudflare_api_token`.
- Each client domain added to his Cloudflare account (so it has a zone).

## Phasing (one spec, one plan; the plan sequences tasks)

1. Schema (Component 1) + types.
2. CF ingestion edge fn + zone resolution + pg_cron + manual trigger (Component 2)
   + backups source wiring (Component 3).
3. Client charts + tier gating (Component 4) + package feature lists (Component 5).
4. Admin mirror (Component 6).
5. Clients table (Component 7).

## Open risks

- **Turnstile analytics API availability** on the Free plan (resolved empirically in
  step 2; graceful "בקרוב" fallback if absent).
- **Zone resolution** depends on the site domain being a zone in Ori's CF account;
  projects without a resolvable zone simply show no CF data (no error).

## Not in this spec

- Building Ori's n8n flows (external automation); per-site (WordPress file) backup
  infrastructure; historical backfill of CF data before ingestion starts; alerting
  on metric thresholds.

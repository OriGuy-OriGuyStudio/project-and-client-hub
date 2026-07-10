// poll-site-metrics — daily metrics poller (pg_cron via pg_net, or the admin
// "refresh now" button). For every ACTIVE package with a site_url it collects:
//   • PageSpeed Insights  → pagespeed / lcp_ms / cls / inp_ms
//   • UptimeRobot         → uptime_pct   (matched by host)
//   • Cloudflare Web Analytics (RUM) → visitors / pageviews (matched by site host)
//   • Cloudflare firewall events → threats_blocked (30-day count for the site's
//     zone; 0 when the zone is connected but had no events). Only sites whose
//     domain is a zone in the account are covered — the checklist adds each
//     client's domain to Cloudflare, so a newly onboarded client is covered too.
// and merge-upserts today's site_metrics row. Each source is best-effort.
//
// Auth: x-webhook-secret == webhook_secrets['metrics_ingest'], OR an admin JWT.
// Secrets (all in webhook_secrets): pagespeed_key, uptimerobot_key,
// cloudflare_token, cloudflare_account. The token needs Zone Read + Analytics
// Read for firewall events.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function host(u: string | null | undefined): string {
  try { return new URL(u!).host.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

async function pageSpeed(siteUrl: string, key: string) {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", siteUrl);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.set("category", "performance");
  if (key) api.searchParams.set("key", key);
  const r = await fetch(api.toString());
  if (!r.ok) throw new Error(`psi ${r.status}`);
  const d = await r.json();
  const lh = d.lighthouseResult ?? {};
  const audits = lh.audits ?? {};
  const score = Math.round((lh.categories?.performance?.score ?? 0) * 100) || null;
  const lcp = Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0) || null;
  const clsRaw = audits["cumulative-layout-shift"]?.numericValue;
  const cls = clsRaw != null ? Number(Number(clsRaw).toFixed(3)) : null;
  const inpField = d.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT_MS?.percentile;
  const inp = inpField != null ? Math.round(inpField) : null;
  return { pagespeed: score, lcp_ms: lcp, cls, inp_ms: inp };
}

// UptimeRobot: one call → { host: uptimePct }
async function uptimeMap(key: string): Promise<Record<string, number>> {
  const r = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({ api_key: key, format: "json", custom_uptime_ratios: "30" }),
  });
  const d = await r.json();
  const map: Record<string, number> = {};
  for (const m of d.monitors ?? []) {
    const h = host(m.url);
    const ratio = parseFloat(String(m.custom_uptime_ratio ?? "").split("-")[0]);
    if (h && Number.isFinite(ratio)) map[h] = Number(ratio.toFixed(2));
  }
  return map;
}

// Cloudflare Web Analytics (RUM) for one host (most recent day). Filters by
// requestHost so each site gets ITS OWN numbers. count = page views, sum.visits
// = visits.
async function cfTraffic(token: string, account: string, reqHost: string) {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const query = `query($account:String!,$since:Date!,$until:Date!,$host:String!){viewer{accounts(filter:{accountTag:$account}){rumPageloadEventsAdaptiveGroups(limit:1,filter:{date_geq:$since,date_leq:$until,requestHost:$host},orderBy:[date_DESC]){count sum{visits}dimensions{date}}}}}`;
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { account, since, until: today, host: reqHost } }),
  });
  const d = await r.json();
  if (d.errors?.length) throw new Error(`rum graphql: ${JSON.stringify(d.errors).slice(0, 300)}`);
  const g = d.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0];
  if (!g) return { visitors: null, pageviews: null };
  return { visitors: g.sum?.visits ?? null, pageviews: g.count ?? null };
}

// All zones in the account → { "example.com": "zoneTag" }. Used to resolve which
// zone a site's host belongs to for firewall-event (threats) queries.
async function fetchZones(token: string, account: string): Promise<Record<string, string>> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=200&account.id=${account}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (!d.success) throw new Error(`zones: ${JSON.stringify(d.errors ?? d).slice(0, 200)}`);
  const map: Record<string, string> = {};
  for (const z of d.result ?? []) map[String(z.name).toLowerCase()] = z.id;
  return map;
}

// The zone tag whose name is the host itself or its parent (longest match wins,
// so multi-part TLDs like co.il resolve correctly). null if the site is not in
// the account's Cloudflare.
function zoneForHost(reqHost: string, zones: Record<string, string>): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const name of Object.keys(zones)) {
    if ((reqHost === name || reqHost.endsWith("." + name)) && name.length > bestLen) {
      best = name;
      bestLen = name.length;
    }
  }
  return best ? zones[best] : null;
}

// Threats blocked = firewall events for the host over the last 30 days. Returns
// 0 when the zone is connected but had no events (a real, honest zero).
async function cfThreats(token: string, zoneTag: string, reqHost: string): Promise<number> {
  const until = new Date().toISOString();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const query = `query($zone:String!,$since:Time!,$until:Time!,$host:String!){viewer{zones(filter:{zoneTag:$zone}){firewallEventsAdaptiveGroups(limit:1,filter:{datetime_geq:$since,datetime_leq:$until,clientRequestHTTPHost:$host}){count}}}}`;
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { zone: zoneTag, since, until, host: reqHost } }),
  });
  const d = await r.json();
  if (d.errors?.length) throw new Error(`fw graphql: ${JSON.stringify(d.errors).slice(0, 300)}`);
  const g = d.data?.viewer?.zones?.[0]?.firewallEventsAdaptiveGroups?.[0];
  return g?.count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: secRows } = await admin.from("webhook_secrets").select("name, value")
    .in("name", ["metrics_ingest", "pagespeed_key", "uptimerobot_key", "cloudflare_token", "cloudflare_account"]);
  const secrets: Record<string, string> = Object.fromEntries((secRows ?? []).map((r) => [r.name, r.value]));

  const provided = req.headers.get("x-webhook-secret") ?? "";
  let authed = !!secrets.metrics_ingest && provided === secrets.metrics_ingest;
  if (!authed) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: role } = await asUser.rpc("get_my_role");
      authed = role === "admin";
    }
  }
  if (!authed) return json({ error: "unauthorized" }, 401);

  const psiKey = secrets.pagespeed_key || "";
  const today = new Date().toISOString().slice(0, 10);

  // shared source maps (best-effort, once)
  let upMap: Record<string, number> = {};
  const sourceErrors: Record<string, string> = {};
  if (secrets.uptimerobot_key) {
    try { upMap = await uptimeMap(secrets.uptimerobot_key); } catch (e) { sourceErrors.uptimerobot = String(e); }
  }
  // Web Analytics (RUM) is account-scoped and queried per host in the loop below.
  const cfReady = !!(secrets.cloudflare_token && secrets.cloudflare_account);
  if (secrets.cloudflare_token && !secrets.cloudflare_account) {
    sourceErrors.cloudflare = "missing cloudflare_account secret";
  }
  // Zones map (once) to resolve each site's zone for firewall-event (threats).
  let zonesMap: Record<string, string> = {};
  if (cfReady) {
    try { zonesMap = await fetchZones(secrets.cloudflare_token, secrets.cloudflare_account); }
    catch (e) { sourceErrors.cf_zones = String(e instanceof Error ? e.message : e); }
  }

  // Optional { project_id } in the body → refresh just that one project.
  let onlyProject: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.project_id === "string" && body.project_id) onlyProject = body.project_id;
  } catch { /* no / empty body → poll all */ }

  let pkgQuery = admin
    .from("project_service").select("project_id, site_url").eq("active", true).not("site_url", "is", null);
  if (onlyProject) pkgQuery = pkgQuery.eq("project_id", onlyProject);
  const { data: pkgs, error: pkgErr } = await pkgQuery;
  if (pkgErr) return json({ ok: false, error: pkgErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const p of pkgs ?? []) {
    const siteUrl = p.site_url as string;
    const h = host(siteUrl);
    const metric: Record<string, unknown> = { p_project: p.project_id, p_date: today };
    const got: Record<string, unknown> = { site: siteUrl };

    try { Object.assign(metric, prefix(await pageSpeed(siteUrl, psiKey))); got.pagespeed = metric.p_pagespeed; }
    catch (e) { got.pagespeed_err = String(e instanceof Error ? e.message : e); }

    if (upMap[h] != null) { metric.p_uptime_pct = upMap[h]; got.uptime_pct = upMap[h]; }

    // Web Analytics numbers for THIS exact host (requestHost filter).
    if (cfReady) {
      try {
        const cf = await cfTraffic(secrets.cloudflare_token, secrets.cloudflare_account, h);
        metric.p_visitors = cf.visitors; metric.p_pageviews = cf.pageviews;
        got.cf = cf;
      } catch (e) { got.cf_err = String(e instanceof Error ? e.message : e); }

      // Threats blocked = firewall events for the site's zone (0 when none).
      const zoneTag = zoneForHost(h, zonesMap);
      if (zoneTag) {
        try {
          const t = await cfThreats(secrets.cloudflare_token, zoneTag, h);
          metric.p_threats_blocked = t; got.threats = t;
        } catch (e) { got.threats_err = String(e instanceof Error ? e.message : e); }
      } else {
        got.threats = "no-zone-in-account";
      }
    }

    try {
      const { error } = await admin.rpc("upsert_site_metrics", metric);
      if (error) throw new Error(error.message);
    } catch (e) { got.save_err = String(e instanceof Error ? e.message : e); }
    results.push(got);
  }

  return json({ ok: true, has_psi_key: !!psiKey, uptime_monitors: Object.keys(upMap).length, cf_enabled: cfReady, sourceErrors, count: results.length, results });
});

// map pageSpeed fields to the RPC's p_* args
function prefix(m: { pagespeed: number | null; lcp_ms: number | null; cls: number | null; inp_ms: number | null }) {
  return { p_pagespeed: m.pagespeed, p_lcp_ms: m.lcp_ms, p_cls: m.cls, p_inp_ms: m.inp_ms };
}

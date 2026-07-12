// pull-cloudflare-metrics — resolves each active package's Cloudflare zone (by
// domain, cached on project_service.cf_zone_id) and pulls the last few days of
// zone analytics (requests, cached requests, bytes, threats blocked, unique
// visitors) via the Cloudflare GraphQL Analytics API, upserting into
// site_metrics per day via the atomic `upsert_site_metrics` RPC (coalesce
// on conflict) so this never clobbers non-null values written by other
// sources (e.g. ingest-site-metrics / pagespeed/uptime pushers) racing on the
// same project/day row.
//
// Auth: x-webhook-secret == webhook_secrets['metrics_ingest'], OR an admin JWT
// (same pattern as poll-site-metrics) — checked BEFORE the cloudflare_api_token
// lookup below.
// Secret: webhook_secrets['cloudflare_api_token'].
//
// Body (optional): { "project_id": "<uuid>" } to limit the pull to one package.

import { createClient } from "npm:@supabase/supabase-js@2";

const CF = "https://api.cloudflare.com/client/v4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const domainOf = (url: string) => {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: secRows, error: secErr } = await admin
    .from("webhook_secrets")
    .select("name, value")
    .in("name", ["metrics_ingest", "cloudflare_api_token"]);
  if (secErr) return json({ ok: false, error: secErr.message }, 500);
  const secrets: Record<string, string> = Object.fromEntries((secRows ?? []).map((r) => [r.name, r.value]));

  // Auth gate: x-webhook-secret == webhook_secrets['metrics_ingest'], OR an
  // admin JWT (mirrors poll-site-metrics exactly).
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

  const token = secrets.cloudflare_api_token;
  if (!token) return json({ ok: false, error: "no cloudflare_api_token" }, 400);

  const body = (await req.json().catch(() => ({}))) as { project_id?: string };

  let q = admin
    .from("project_service")
    .select("project_id, site_url, cf_zone_id, cf_turnstile_sitekey, active")
    .eq("active", true);
  if (body.project_id) q = q.eq("project_id", body.project_id);
  const { data: pkgs, error: pkgErr } = await q;
  if (pkgErr) return json({ ok: false, error: pkgErr.message }, 500);

  // Resolve the CF account id once, for account-scoped Turnstile analytics.
  // Turnstile stays null if this fails (e.g. token lacks account read).
  let accountId: string | null = null;
  try {
    const ar = await fetch(`${CF}/accounts`, { headers: { Authorization: `Bearer ${token}` } });
    accountId = (await ar.json())?.result?.[0]?.id ?? null;
  } catch { /* leave null */ }

  const results: Record<string, string> = {};

  for (const p of pkgs ?? []) {
    try {
      const domain = domainOf(p.site_url ?? "");
      if (!domain) {
        results[p.project_id] = "no domain";
        continue;
      }

      // resolve + cache the CF zone id for this domain if we don't have it yet.
      // Walk up the domain (full hostname -> apex) so a subdomain like
      // insights.origuystudio.com resolves to the origuystudio.com zone; CF
      // zones are the registrable apex, and a subdomain belongs to it.
      let zone = p.cf_zone_id as string | null;
      if (!zone) {
        const parts = domain.split(".");
        for (let i = 0; i <= parts.length - 2 && !zone; i++) {
          const candidate = parts.slice(i).join(".");
          const zr = await fetch(`${CF}/zones?name=${encodeURIComponent(candidate)}&status=active`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const zj = await zr.json();
          zone = zj?.result?.[0]?.id ?? null;
        }
        const { error: zoneErr } = await admin
          .from("project_service")
          .update({ cf_zone_id: zone, cf_zone_checked_at: new Date().toISOString() })
          .eq("project_id", p.project_id);
        if (zoneErr) throw new Error(`zone cache write: ${zoneErr.message}`);
        if (!zone) {
          results[p.project_id] = "zone not found";
          continue;
        }
      }

      // pull the last 3 days of daily zone analytics (today is usually partial)
      const since = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
      const until = new Date().toISOString().slice(0, 10);
      const gql = {
        query: `query($zone:String!,$since:Date!,$until:Date!){viewer{zones(filter:{zoneTag:$zone}){httpRequests1dGroups(limit:10,filter:{date_geq:$since,date_leq:$until},orderBy:[date_ASC]){dimensions{date} uniq{uniques} sum{requests cachedRequests bytes threats}}}}}`,
        variables: { zone, since, until },
      };
      const gr = await fetch(`${CF}/graphql`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(gql),
      });
      const gj = await gr.json();
      if (gj?.errors?.length) throw new Error(String(gj.errors[0]?.message ?? "cloudflare graphql error"));
      const groups = gj?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

      let daysWritten = 0;
      for (const g of groups) {
        const metricDate = g?.dimensions?.date;
        if (!metricDate) continue;
        const { error: upsertErr } = await admin.rpc("upsert_site_metrics", {
          p_project: p.project_id,
          p_date: metricDate,
          p_visitors: g.uniq?.uniques ?? null,
          p_threats_blocked: g.sum?.threats ?? null,
          p_requests: g.sum?.requests ?? null,
          p_cached_requests: g.sum?.cachedRequests ?? null,
          p_bytes: g.sum?.bytes ?? null,
        });
        if (upsertErr) throw new Error(`site_metrics upsert: ${upsertErr.message}`);
        daysWritten++;
      }

      // Turnstile: per-widget (siteKey), account-scoped. If this package has a
      // sitekey set, pull that widget's daily anti-bot check count into
      // turnstile_blocked (the API exposes only a total count, no solved/blocked
      // split). Only overwrites turnstile_blocked (coalesce), never other fields.
      const sitekey = (p as { cf_turnstile_sitekey?: string | null }).cf_turnstile_sitekey;
      let turnstileDays = 0;
      if (sitekey && accountId) {
        const tq = {
          query: `query($a:String!,$sk:String!,$since:Date!,$until:Date!){viewer{accounts(filter:{accountTag:$a}){turnstileAdaptiveGroups(limit:10,filter:{date_geq:$since,date_leq:$until,siteKey:$sk},orderBy:[date_ASC]){count dimensions{date}}}}}`,
          variables: { a: accountId, sk: sitekey, since, until },
        };
        const tr = await fetch(`${CF}/graphql`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(tq),
        });
        const tj = await tr.json();
        if (tj?.errors?.length) throw new Error(String(tj.errors[0]?.message ?? "cloudflare turnstile error"));
        const tGroups = tj?.data?.viewer?.accounts?.[0]?.turnstileAdaptiveGroups ?? [];
        for (const g of tGroups) {
          const d = g?.dimensions?.date;
          if (!d) continue;
          const { error: tErr } = await admin.rpc("upsert_site_metrics", {
            p_project: p.project_id,
            p_date: d,
            p_turnstile_blocked: g.count ?? null,
          });
          if (tErr) throw new Error(`turnstile upsert: ${tErr.message}`);
          turnstileDays++;
        }
      }

      results[p.project_id] = `${daysWritten} zone days, ${turnstileDays} turnstile days`;
    } catch (e) {
      results[p.project_id] = String(e instanceof Error ? e.message : e);
      continue;
    }
  }

  return json({ ok: true, results });
});

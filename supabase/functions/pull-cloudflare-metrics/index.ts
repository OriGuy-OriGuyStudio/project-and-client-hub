// pull-cloudflare-metrics — resolves each active package's Cloudflare zone (by
// domain, cached on project_service.cf_zone_id) and pulls the last few days of
// zone analytics (requests, cached requests, bytes, threats blocked, unique
// visitors) via the Cloudflare GraphQL Analytics API, upserting into
// site_metrics per day via the atomic `upsert_site_metrics` RPC (coalesce
// on conflict) so this never clobbers non-null values written by other
// sources (e.g. ingest-site-metrics / pagespeed/uptime pushers) racing on the
// same project/day row.
//
// Auth: no user JWT (verify_jwt off) — called by a cron job or invoked
// directly by the admin, same pattern as ingest-site-metrics / poll-site-metrics.
// Secret: webhook_secrets['cloudflare_api_token'] (a CF API token with
// Zone:Read + Analytics:Read on the zones in question). Ori adds this at QA
// time; until then the function returns a clean "no cloudflare_api_token" error.
//
// Body (optional): { "project_id": "<uuid>" } to limit the pull to one
// package; empty body processes every active project_service row.
//
// Each package is processed inside its own try/catch (mirrors
// poll-site-metrics's per-source best-effort pattern) so a bad zone / CF error
// for ONE package (e.g. a non-JSON 403 for a zone the token can't access)
// can't abort the whole run and silently starve every remaining package.

import { createClient } from "npm:@supabase/supabase-js@2";

const CF = "https://api.cloudflare.com/client/v4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-webhook-secret",
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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sec } = await admin
    .from("webhook_secrets")
    .select("value")
    .eq("name", "cloudflare_api_token")
    .maybeSingle();
  const token = sec?.value as string | undefined;
  if (!token) return json({ ok: false, error: "no cloudflare_api_token" }, 400);

  const body = (await req.json().catch(() => ({}))) as { project_id?: string };

  let q = admin.from("project_service").select("project_id, site_url, cf_zone_id, active").eq("active", true);
  if (body.project_id) q = q.eq("project_id", body.project_id);
  const { data: pkgs } = await q;

  const results: Record<string, string> = {};

  for (const p of pkgs ?? []) {
    try {
      const domain = domainOf(p.site_url ?? "");
      if (!domain) {
        results[p.project_id] = "no domain";
        continue;
      }

      // resolve + cache the CF zone id for this domain if we don't have it yet
      let zone = p.cf_zone_id as string | null;
      if (!zone) {
        const zr = await fetch(`${CF}/zones?name=${encodeURIComponent(domain)}&status=active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const zj = await zr.json();
        zone = zj?.result?.[0]?.id ?? null;
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

      // pull the last 3 days of daily zone analytics (today is usually partial,
      // but re-pulling recent days keeps them fresh as the day progresses)
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

      // atomic coalesce-upsert per day: `upsert_site_metrics` only overwrites
      // columns whose new value is non-null, so a concurrent writer (e.g.
      // poll-site-metrics / ingest-site-metrics) touching the same
      // project/day row can't be clobbered back to null by this pull.
      let daysWritten = 0;
      for (const g of groups) {
        const metricDate = g?.dimensions?.date;
        if (!metricDate) continue; // guard a partial/malformed group
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

      // Turnstile: probe the account/zone Turnstile analytics dataset; if the
      // query errors or returns nothing (e.g. unavailable on the current CF
      // plan), leave turnstile_solved / turnstile_blocked null and the client
      // dashboard shows "בקרוב". Not wired yet — the exact dataset/field names
      // need confirming against a real zone during Ori QA before we upsert them.
      results[p.project_id] = `${daysWritten} days`;
    } catch (e) {
      results[p.project_id] = String(e instanceof Error ? e.message : e);
      continue;
    }
  }

  return json({ ok: true, results });
});

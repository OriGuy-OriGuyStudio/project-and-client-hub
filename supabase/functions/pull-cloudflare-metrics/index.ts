// pull-cloudflare-metrics — resolves each active package's Cloudflare zone (by
// domain, cached on project_service.cf_zone_id) and pulls the last few days of
// zone analytics (requests, cached requests, bytes, threats blocked, unique
// visitors) via the Cloudflare GraphQL Analytics API, merge-upserting into
// site_metrics per day without clobbering non-null values written by other
// sources (e.g. ingest-site-metrics / pagespeed/uptime pushers).
//
// Auth: no user JWT (verify_jwt off) — called by a cron job or invoked
// directly by the admin, same pattern as ingest-site-metrics / poll-site-metrics.
// Secret: webhook_secrets['cloudflare_api_token'] (a CF API token with
// Zone:Read + Analytics:Read on the zones in question). Ori adds this at QA
// time; until then the function returns a clean "no cloudflare_api_token" error.
//
// Body (optional): { "project_id": "<uuid>" } to limit the pull to one
// package; empty body processes every active project_service row.

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
      await admin
        .from("project_service")
        .update({ cf_zone_id: zone, cf_zone_checked_at: new Date().toISOString() })
        .eq("project_id", p.project_id);
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
    const groups = gj?.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

    for (const g of groups) {
      const row: Record<string, unknown> = {
        project_id: p.project_id,
        metric_date: g.dimensions.date,
        requests: g.sum.requests ?? null,
        cached_requests: g.sum.cachedRequests ?? null,
        bytes: g.sum.bytes ?? null,
        threats_blocked: g.sum.threats ?? null,
        visitors: g.uniq?.uniques ?? null,
      };

      // merge-upsert: don't let a null from this pull clobber a non-null
      // value another source (e.g. pagespeed/uptime pusher) already wrote
      // for the same project/day.
      const { data: existing } = await admin
        .from("site_metrics")
        .select("*")
        .eq("project_id", p.project_id)
        .eq("metric_date", row.metric_date)
        .maybeSingle();
      const merged: Record<string, unknown> = { ...row };
      if (existing) {
        const existingRow = existing as Record<string, unknown>;
        for (const k of Object.keys(row)) {
          if (row[k] == null && existingRow[k] != null) merged[k] = existingRow[k];
        }
      }
      await admin.from("site_metrics").upsert(merged, { onConflict: "project_id,metric_date" });
    }

    // Turnstile: probe the account/zone Turnstile analytics dataset; if the
    // query errors or returns nothing (e.g. unavailable on the current CF
    // plan), leave turnstile_solved / turnstile_blocked null and the client
    // dashboard shows "בקרוב". Not wired yet — the exact dataset/field names
    // need confirming against a real zone during Ori QA before we upsert them.
    results[p.project_id] = `${groups.length} days`;
  }

  return json({ ok: true, results });
});

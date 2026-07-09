// poll-site-metrics — daily PageSpeed poller. Triggered by pg_cron via pg_net.
// Loops every ACTIVE package that has a site_url, calls the Google PageSpeed
// Insights API, and upserts today's row into site_metrics. No external tooling.
//
// Auth: x-webhook-secret must equal webhook_secrets['metrics_ingest'].
// The PSI API key is read from webhook_secrets['pagespeed_key'] (or the
// PAGESPEED_API_KEY env var). Without a key PSI is heavily rate-limited.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function pollOne(siteUrl: string, key: string) {
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
  // field INP (CrUX) if available, else null
  const inpField = d.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT_MS?.percentile;
  const inp = inpField != null ? Math.round(inpField) : null;
  return { pagespeed: score, lcp_ms: lcp, cls, inp_ms: inp };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: secRows } = await admin
    .from("webhook_secrets").select("name, value").in("name", ["metrics_ingest", "pagespeed_key"]);
  const secrets: Record<string, string> = Object.fromEntries((secRows ?? []).map((r) => [r.name, r.value]));
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!secrets.metrics_ingest || provided !== secrets.metrics_ingest) return json({ error: "unauthorized" }, 401);

  const key = secrets.pagespeed_key || Deno.env.get("PAGESPEED_API_KEY") || "";
  const today = new Date().toISOString().slice(0, 10);

  const { data: pkgs, error: pkgErr } = await admin
    .from("project_service").select("project_id, site_url").eq("active", true).not("site_url", "is", null);
  if (pkgErr) return json({ ok: false, error: pkgErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const p of pkgs ?? []) {
    const siteUrl = p.site_url as string;
    try {
      const m = await pollOne(siteUrl, key);
      // merge-upsert: only overwrites the speed columns, keeps uptime/traffic
      const { error } = await admin.rpc("upsert_site_metrics", {
        p_project: p.project_id, p_date: today,
        p_pagespeed: m.pagespeed, p_lcp_ms: m.lcp_ms, p_cls: m.cls, p_inp_ms: m.inp_ms,
      });
      if (error) throw new Error(error.message);
      results.push({ site: siteUrl, ...m });
    } catch (e) {
      results.push({ site: siteUrl, error: String(e instanceof Error ? e.message : e) });
    }
  }

  return json({ ok: true, has_key: !!key, count: results.length, results });
});

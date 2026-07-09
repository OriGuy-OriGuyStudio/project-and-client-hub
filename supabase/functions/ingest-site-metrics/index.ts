// ingest-site-metrics — inbound webhook that fills the client "השירות שלך"
// dashboard. Any monitoring source (n8n, GTmetrix, UptimeRobot, Cloudflare, a
// cron job, or a manual curl) POSTs a JSON payload here with the shared secret.
//
// Auth: x-webhook-secret header must equal webhook_secrets['metrics_ingest'].
// verify_jwt is OFF (custom secret auth), same pattern as notify-lead.
//
// Body:
//   {
//     "site_url": "https://insights.origuystudio.com",   // or "project_id": "<uuid>"
//     "metrics": {                                        // upsert into site_metrics (per day)
//       "metric_date": "2026-07-09",                      // optional, defaults to today
//       "pagespeed": 96, "lcp_ms": 1200, "cls": 0.02, "inp_ms": 90,
//       "uptime_pct": 99.98, "visitors": 120, "pageviews": 200, "threats_blocked": 5
//     },
//     "log": [ { "kind": "update", "title": "עדכון ליבה + 3 תוספים", "count": 4 } ]
//   }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // auth via shared secret
  const { data: sec } = await admin.from("webhook_secrets").select("value").eq("name", "metrics_ingest").maybeSingle();
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!sec?.value || provided !== sec.value) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // resolve the project: explicit project_id, or by an active package's site_url
  let projectId = (body.project_id as string) || "";
  if (!projectId && body.site_url) {
    const { data: ps } = await admin
      .from("project_service").select("project_id").eq("site_url", body.site_url).maybeSingle();
    projectId = (ps?.project_id as string) || "";
  }
  if (!projectId) return json({ error: "project not found (send project_id, or a site_url that matches an active package)" }, 404);

  const results: Record<string, unknown> = { project_id: projectId };

  const m = body.metrics as Record<string, unknown> | undefined;
  if (m && typeof m === "object") {
    // merge-upsert so a source that sends only some fields (e.g. uptime) doesn't
    // null the columns another source wrote for the same day.
    const { error } = await admin.rpc("upsert_site_metrics", {
      p_project: projectId,
      p_date: (m.metric_date as string) || new Date().toISOString().slice(0, 10),
      p_visitors: num(m.visitors), p_pageviews: num(m.pageviews), p_sessions: num(m.sessions),
      p_pagespeed: num(m.pagespeed), p_lcp_ms: num(m.lcp_ms), p_cls: num(m.cls), p_inp_ms: num(m.inp_ms),
      p_uptime_pct: num(m.uptime_pct), p_threats_blocked: num(m.threats_blocked),
      p_meta: (m.meta as unknown) ?? null,
    });
    if (error) return json({ ok: false, error: `site_metrics: ${error.message}` }, 500);
    results.metrics = "ok";
  }

  const log = body.log as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(log) && log.length) {
    const rows = log.map((l) => ({
      project_id: projectId,
      kind: String(l.kind ?? "note"),
      title: (l.title as string) ?? null,
      count: Number(l.count ?? 1),
      occurred_at: (l.occurred_at as string) ?? new Date().toISOString(),
      meta: (l.meta as unknown) ?? null,
    }));
    const { error } = await admin.from("maintenance_log").insert(rows);
    if (error) return json({ ok: false, error: `maintenance_log: ${error.message}` }, 500);
    results.log = rows.length;
  }

  return json({ ok: true, ...results });
});

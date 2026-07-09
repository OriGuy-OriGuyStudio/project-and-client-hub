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
    const row = {
      project_id: projectId,
      metric_date: (m.metric_date as string) || new Date().toISOString().slice(0, 10),
      visitors: num(m.visitors), pageviews: num(m.pageviews), sessions: num(m.sessions),
      pagespeed: num(m.pagespeed), lcp_ms: num(m.lcp_ms), cls: num(m.cls), inp_ms: num(m.inp_ms),
      uptime_pct: num(m.uptime_pct), threats_blocked: num(m.threats_blocked),
      meta: (m.meta as unknown) ?? null,
    };
    const { error } = await admin.from("site_metrics").upsert(row, { onConflict: "project_id,metric_date" });
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

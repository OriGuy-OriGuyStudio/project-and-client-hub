// cloudways-backup — the REAL nightly backup for service clients. Replaces the
// old blind logger that wrote a "backup" row every night regardless of reality.
//
// Each daily run does two phases:
//   1. FINALIZE: poll every still-pending backup from prior runs. A completed
//      one becomes a real maintenance_log 'backup' row (what the client sees on
//      the dashboard); a failed or stuck one alerts the admin instead of
//      silently claiming success.
//   2. TRIGGER: for each active service package mapped to a Cloudways app that
//      has no run yet today, trigger a real Cloudways backup and record it as
//      pending for the next run to verify.
//
// Auth: x-webhook-secret == webhook_secrets['metrics_ingest'] (the cron sends
// it) or an admin JWT. Cloudways access needs CLOUDWAYS_EMAIL + CLOUDWAYS_API_KEY
// as edge-function secrets; without them the function no-ops with a clear message.

import { createClient } from "npm:@supabase/supabase-js@2";

const CW = "https://api.cloudways.com/api/v1";
// A backup still pending after this long is treated as stuck/failed.
const STUCK_MS = 6 * 60 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function cwToken(email: string, apiKey: string): Promise<string> {
  // Cloudways' new "API Integration" Personal Access Tokens (prefixed "cw...")
  // are used directly as the Bearer token, no OAuth exchange. The classic
  // Account > API key still needs email + api_key exchanged for an access token.
  if (apiKey.startsWith("cw")) return apiKey;
  const res = await fetch(`${CW}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, api_key: apiKey }),
  });
  if (!res.ok) throw new Error(`cloudways oauth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token as string;
}

async function cwTakeBackup(token: string, serverId: string, appId: string): Promise<string> {
  const res = await fetch(`${CW}/app/manage/takeBackup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ server_id: serverId, app_id: appId }),
  });
  if (!res.ok) throw new Error(`takeBackup ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  if (!j?.operation_id) throw new Error("takeBackup returned no operation_id");
  return String(j.operation_id);
}

// -1 failed, 0 in progress, 1 completed.
async function cwOperation(token: string, opId: string): Promise<number> {
  const res = await fetch(`${CW}/operation/${opId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`operation ${res.status}`);
  const j = await res.json();
  return parseInt(String(j?.operation?.is_completed ?? "0"), 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth: cron secret, or an admin JWT (for a manual run from the tools UI).
  const got = req.headers.get("x-webhook-secret") ?? "";
  const { data: secretRow } = await admin.from("webhook_secrets").select("value").eq("name", "metrics_ingest").maybeSingle();
  let authed = !!secretRow?.value && secretRow.value === got;
  if (!authed) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: role } = await asUser.rpc("get_my_role");
      authed = role === "admin";
    }
  }
  if (!authed) return json({ ok: false, error: "forbidden" }, 403);

  const email = Deno.env.get("CLOUDWAYS_EMAIL");
  const apiKey = Deno.env.get("CLOUDWAYS_API_KEY");
  if (!email || !apiKey) {
    return json({ ok: false, error: "Cloudways credentials not configured (CLOUDWAYS_EMAIL / CLOUDWAYS_API_KEY)" }, 503);
  }

  let token: string;
  try {
    token = await cwToken(email, apiKey);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 502);
  }

  const summary = { finalized_success: 0, finalized_failed: 0, triggered: 0, skipped_no_map: 0 };

  // ---- Phase 1: finalize pending runs --------------------------------------
  const { data: pending } = await admin
    .from("cloudways_backup_runs")
    .select("id, project_id, operation_id, triggered_at")
    .eq("status", "pending");

  for (const run of pending ?? []) {
    if (!run.operation_id) continue;
    let state = 0;
    try {
      state = await cwOperation(token, run.operation_id);
    } catch {
      continue; // transient; try again next run
    }
    if (state === 1) {
      await admin.from("maintenance_log").insert({
        project_id: run.project_id,
        kind: "backup",
        title: "גיבוי אוטומטי",
        occurred_at: run.triggered_at,
        meta: { source: "cloudways", operation_id: run.operation_id, verified: true },
      });
      await admin.from("cloudways_backup_runs").update({ status: "success", resolved_at: new Date().toISOString() }).eq("id", run.id);
      summary.finalized_success++;
    } else if (state === -1 || Date.now() - new Date(run.triggered_at).getTime() > STUCK_MS) {
      await admin.from("cloudways_backup_runs")
        .update({ status: "failed", error: state === -1 ? "cloudways reported failure" : "timed out", resolved_at: new Date().toISOString() })
        .eq("id", run.id);
      await admin.rpc("notify_admin", {
        p_type: "service_agreement",
        p_title: "גיבוי אוטומטי נכשל",
        p_body: "גיבוי Cloudways לא הושלם בהצלחה, כדאי לבדוק את השרת.",
        p_link: "/admin/clients/" + run.project_id,
        p_project_id: run.project_id,
        p_entity_id: null,
      });
      summary.finalized_failed++;
    }
    // else still in progress , leave pending for the next run
  }

  // ---- Phase 2: trigger today's backups ------------------------------------
  const { data: services } = await admin
    .from("project_service")
    .select("project_id, cloudways_server_id, cloudways_app_id")
    .eq("active", true);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (const s of services ?? []) {
    if (!s.cloudways_server_id || !s.cloudways_app_id) {
      summary.skipped_no_map++;
      continue;
    }
    // Skip if this project already has a run today (pending or success), so a
    // manual re-run of the function never double-triggers.
    const { count } = await admin
      .from("cloudways_backup_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", s.project_id)
      .neq("status", "failed")
      .gte("triggered_at", todayStart.toISOString());
    if ((count ?? 0) > 0) continue;

    try {
      const opId = await cwTakeBackup(token, s.cloudways_server_id, s.cloudways_app_id);
      await admin.from("cloudways_backup_runs").insert({
        project_id: s.project_id,
        server_id: s.cloudways_server_id,
        app_id: s.cloudways_app_id,
        operation_id: opId,
        status: "pending",
      });
      summary.triggered++;
    } catch (e) {
      await admin.from("cloudways_backup_runs").insert({
        project_id: s.project_id,
        server_id: s.cloudways_server_id,
        app_id: s.cloudways_app_id,
        status: "failed",
        error: String(e).slice(0, 300),
        resolved_at: new Date().toISOString(),
      });
      await admin.rpc("notify_admin", {
        p_type: "service_agreement",
        p_title: "גיבוי אוטומטי נכשל בהפעלה",
        p_body: "לא הצלחתי להפעיל גיבוי Cloudways, כדאי לבדוק את החיבור.",
        p_link: "/admin/clients/" + s.project_id,
        p_project_id: s.project_id,
        p_entity_id: null,
      });
      summary.finalized_failed++;
    }
  }

  return json({ ok: true, ...summary });
});

// send-report — emails a client their monthly maintenance report: a few warm
// headline numbers + a button to the full landing page (/report/<token>).
// Admin-only, called from the maintenance tab. Ensures a preview_token exists.
// Secret: Gmail OAuth (GOOGLE_CLIENT_ID/SECRET, GMAIL_REFRESH_TOKEN).

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM_NAME = "Ori Guy Studio";
const FROM_EMAIL = "origuy@origuystudio.com";
const STUDIO_BCC = "origuy@origuystudio.com";
const DEFAULT_PORTAL = "https://orion.origuystudio.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function escapeHtml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
const encoder = new TextEncoder();
function b64utf8(s: string) { let bin = ""; const b = encoder.encode(s); for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]); return btoa(bin); }
const b64urlAscii = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function stat(n: string | number, label: string) {
  return `<td style="text-align:center;padding:8px 6px;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif"><div style="font-size:24px;font-weight:800;color:#B4D670">${escapeHtml(String(n))}</div><div style="font-size:12px;color:#a7a7ad">${escapeHtml(label)}</div></td>`;
}
function buildHtml(o: { business: string; month: string; hi: string; stats: string; reportUrl: string; studioName: string }) {
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><meta name="color-scheme" content="dark light"><style>html,body,div,p,span,a,td,th,table,tr,h1,h2,h3,h4,h5,h6,li,ul,ol,strong,b,em,small,button{font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif !important;}</style></head><body style="margin:0;background:#0b0a10;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
  <div dir="rtl" style="background:#0b0a10;padding:24px 16px;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#16151c;border:1px solid #2a2a33;border-radius:18px;overflow:hidden">
      <div dir="rtl" style="padding:22px 28px;border-bottom:1px solid #2a2a33;text-align:right">
        <span style="font-size:22px;font-weight:800;color:#fff">Orion</span>
        <span style="font-size:13px;color:#B4D670"> · ${escapeHtml(o.studioName)}</span>
      </div>
      <div dir="rtl" style="padding:28px;text-align:right;color:#e8e8ea;font-size:15px;line-height:1.7">
        <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#fff">הדוח החודשי שלך, ${escapeHtml(o.business)}</p>
        <p style="margin:0 0 14px;color:#a7a7ad">סיכום ${escapeHtml(o.month)}</p>
        <p style="margin:0 0 14px">${escapeHtml(o.hi)}</p>
        <table style="width:100%;border-collapse:collapse;background:#0f0e15;border:1px solid #2a2a33;border-radius:14px;margin:8px 0 18px;font-family:Tahoma,"Segoe UI",Arial,Helvetica,sans-serif"><tr>${o.stats}</tr></table>
        <div style="text-align:center;margin:8px 0">
          <a href="${o.reportUrl}" style="display:inline-block;background:#B4D670;color:#0b0a10;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:999px">צפייה בדוח המלא</a>
        </div>
        <p style="margin:16px 0 0;color:#a7a7ad;font-size:13px">בדוח המלא: מגמת המהירות, האבטחה, הגיבויים והערך שקיבלת, בשפה פשוטה.</p>
      </div>
      <div dir="rtl" style="padding:18px 28px;border-top:1px solid #2a2a33;text-align:right;color:#a7a7ad;font-size:13px">${escapeHtml(o.studioName)}</div>
    </div>
  </div></body></html>`;
}

async function getAccessToken(id: string, secret: string, refresh: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  return (await res.json()).access_token as string;
}
async function sendGmail(token: string, to: string, subject: string, html: string) {
  const mime = [`From: ${FROM_NAME} <${FROM_EMAIL}>`, `To: ${to}`, `Bcc: ${STUDIO_BCC}`, `Subject: =?UTF-8?B?${b64utf8(subject)}?=`, `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, `Content-Transfer-Encoding: base64`, ``, b64utf8(html)].join("\r\n");
  return await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64urlAscii(mime) }),
  });
}

/** Records the send attempt in email_log. Never throws: logging must not
 *  break or fail an email that was actually delivered. */
async function logEmail(
  client: any,
  row: { kind: string; to_email: string; subject: string; html: string; ok: boolean; error?: string; context?: Record<string, unknown> },
) {
  try {
    await client.from("email_log").insert({
      kind: row.kind,
      to_email: row.to_email,
      subject: row.subject,
      html: row.html,
      ok: row.ok,
      error: row.error ?? null,
      context: row.context ?? {},
    });
  } catch (e) {
    console.error("email_log insert failed", String(e));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: role } = await asUser.rpc("get_my_role");
  if (role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  let body: { project_id?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }
  const projectId = String(body?.project_id ?? "").trim();
  if (!projectId) return json({ ok: false, error: "missing project_id" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: ps } = await admin.from("project_service").select("preview_token, notify_email").eq("project_id", projectId).maybeSingle();
  if (!ps) return json({ ok: false, error: "no package" }, 404);
  let token = ps.preview_token as string | null;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    await admin.from("project_service").update({ preview_token: token }).eq("project_id", projectId);
  }

  const { data: proj } = await admin.from("projects").select("client_id, title").eq("id", projectId).maybeSingle();
  const { data: cb } = await admin.from("client_brand").select("business_name").eq("client_id", proj?.client_id).maybeSingle();
  const { data: prof } = await admin.from("profiles").select("email, full_name").eq("id", proj?.client_id).maybeSingle();
  // The package may have its own notification email (set on the landing form
  // / admin edit), which takes priority over the account owner's login email.
  const to = String(ps.notify_email || prof?.email || "").trim();
  if (!to) return json({ ok: false, error: "לא נמצאה כתובת מייל ללקוח." }, 404);

  const { data: latest } = await admin.from("site_metrics").select("pagespeed, uptime_pct").eq("project_id", projectId).order("metric_date", { ascending: false }).limit(1).maybeSingle();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data: logs } = await admin.from("maintenance_log").select("kind, count, occurred_at").eq("project_id", projectId).gte("occurred_at", monthStart.toISOString());
  const upd = (logs ?? []).filter((l) => ["update", "deploy"].includes(l.kind)).reduce((a, l) => a + (l.count ?? 1), 0);
  const bkp = (logs ?? []).filter((l) => l.kind === "backup").reduce((a, l) => a + (l.count ?? 1), 0);

  const apiKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].map((k) => Deno.env.get(k));
  if (apiKeys.some((v) => !v)) return json({ ok: false, error: "Gmail credentials not configured" }, 503);

  const { data: settings } = await admin.from("studio_settings").select("studio_name, portal_url").maybeSingle();
  const studioName = settings?.studio_name || "Ori Guy Studio";
  const portal = (settings?.portal_url || DEFAULT_PORTAL).replace(/\/+$/, "");
  const business = cb?.business_name || proj?.title || "האתר שלך";
  const month = new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const firstName = (prof?.full_name || "").trim().split(/\s+/)[0] || "";
  const hi = firstName ? `היי ${firstName}, ריכזתי לך במה טיפלנו החודש כדי שהאתר שלך יישאר מהיר, זמין ומאובטח.` : "ריכזתי לך במה טיפלנו החודש כדי שהאתר יישאר מהיר, זמין ומאובטח.";
  const stats = [
    latest?.pagespeed != null ? stat(`${latest.pagespeed}`, "מהירות") : "",
    latest?.uptime_pct != null ? stat(`${latest.uptime_pct}%`, "זמינות") : "",
    stat(upd, "עדכונים"),
    stat(bkp, "גיבויים"),
  ].filter(Boolean).join("");
  const reportUrl = `${portal}/report/${token}`;
  const subject = `הדוח החודשי שלך, ${business}`;
  const html = buildHtml({ business, month, hi, stats, reportUrl, studioName });
  const logContext = { project_id: projectId };

  try {
    const access = await getAccessToken(apiKeys[0]!, apiKeys[1]!, apiKeys[2]!);
    const res = await sendGmail(access, to, subject, html);
    if (!res.ok) {
      const detail = await res.text();
      await logEmail(admin, {
        kind: "send-report",
        to_email: to,
        subject,
        html,
        ok: false,
        error: `gmail ${res.status}: ${detail}`,
        context: logContext,
      });
      return json({ ok: false, error: `gmail ${res.status}`, detail }, 502);
    }
    await logEmail(admin, {
      kind: "send-report",
      to_email: to,
      subject,
      html,
      ok: true,
      context: logContext,
    });
    return json({ ok: true, link: reportUrl, to });
  } catch (e) {
    console.error("send-report error", String(e));
    await logEmail(admin, {
      kind: "send-report",
      to_email: to,
      subject,
      html,
      ok: false,
      error: String(e),
      context: logContext,
    });
    return json({ ok: false, error: String(e) }, 500);
  }
});
